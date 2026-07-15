// services/stripe/stripe.webhook.service.js
//
// Signature verification, idempotency, and event dispatch for incoming
// Stripe webhooks. Mirrors ebay.webhook.service.js's shape: unauthenticated
// route (see routes wiring), raw-body signature check, and an atomic
// unique-index "claim" collection (StripeProcessedEvent) instead of a
// read-then-write existence check.

const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Refund = require("../../models/Refund");
const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
const { getStripeClient } = require("./stripe.client.service");
const { syncOrderStock, DIRECTION } = require("../order-stock-sync.service");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const config = require("../../config");
const { logger } = require("../../loaders/logging");

function constructEvent(rawBody, signatureHeader) {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, config.stripe.webhookSecret);
}

// Atomic claim: throws E11000 if this event id was already processed, which
// the caller treats as "already handled, no-op" rather than an error.
async function claimEvent(event) {
  try {
    await StripeProcessedEvent.create({ stripe_event_id: event.id, type: event.type });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

async function handleEvent(event) {
  const isNew = await claimEvent(event);
  if (!isNew) {
    logger.info(`[stripe.webhook] duplicate event ignored: ${event.id} (${event.type})`);
    return;
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      return handlePaymentSucceeded(event.data.object);
    case "payment_intent.payment_failed":
      return handlePaymentFailed(event.data.object);
    case "charge.refunded":
      return handleChargeRefunded(event.data.object);
    default:
      logger.info(`[stripe.webhook] unhandled event type: ${event.type}`);
  }
}

async function handlePaymentSucceeded(intent) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  if (!payment) {
    logger.error(`[stripe.webhook] payment_intent.succeeded for unknown intent ${intent.id}`);
    return;
  }
  if (payment.status === PAYMENT_STATUS.SUCCEEDED) return; // already handled

  const order = await Order.findById(payment.order);
  if (!order) {
    logger.error(`[stripe.webhook] order ${payment.order} missing for intent ${intent.id}`);
    return;
  }

  // Trust nothing from the intent except what Stripe says was actually
  // captured — verify it matches what we billed for before marking paid.
  const amountReceived = intent.amount_received ?? intent.amount;
  if (amountReceived !== order.total) {
    payment.status = PAYMENT_STATUS.FAILED;
    payment.failure_reason = `Amount mismatch: received ${amountReceived}, expected ${order.total}`;
    await payment.save();
    logger.error(
      `[stripe.webhook] AMOUNT MISMATCH order ${order.order_number}: received ${amountReceived}, expected ${order.total} — needs manual review`,
    );
    return; // do not mark paid, do not touch stock
  }

  // The webhook payload only carries payment_method as a bare ID, not the
  // expanded object — so re-retrieve the intent with expand to read card
  // details. Expand `payment_method` directly (a top-level expandable field
  // on PaymentIntent) rather than nesting through `latest_charge` — Stripe
  // rejects "latest_charge.payment_method" as an unsupported expand path.
  // Never rely on the legacy `charges.data[]` shape either way.
  const stripe = getStripeClient();
  const fullIntent = await stripe.paymentIntents.retrieve(intent.id, {
    expand: ["payment_method"],
  });
  const paymentMethod =
    fullIntent.payment_method && typeof fullIntent.payment_method === "object"
      ? fullIntent.payment_method
      : null;

  payment.status = PAYMENT_STATUS.SUCCEEDED;
  payment.amount = amountReceived;
  payment.paid_at = new Date();
  payment.card_brand = paymentMethod?.card?.brand || null;
  payment.card_last4 = paymentMethod?.card?.last4 || null;
  await payment.save();

  order.status = ORDER_STATUS.PAID;

  const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.DEDUCT);
  if (hasShortfall) {
    order.has_stock_issue = true;
    order.stock_issue_note = note;
  }

  await order.save();

  logger.info(`[stripe.webhook] order ${order.order_number} marked paid (intent ${intent.id})`);
}

async function handlePaymentFailed(intent) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  if (!payment) {
    logger.warn(`[stripe.webhook] payment_intent.payment_failed for unknown intent ${intent.id}`);
    return;
  }
  if (payment.status === PAYMENT_STATUS.SUCCEEDED) return; // never downgrade a completed payment

  payment.status = PAYMENT_STATUS.FAILED;
  payment.failure_reason = intent.last_payment_error?.message || "Payment failed";
  await payment.save();
  // Order stays pending_payment — the storefront can retry on the same order/intent.
}

// Stripe's refund `reason` values don't line up with ours — used only when
// reconciling a refund we didn't create ourselves (dashboard-issued).
function mapStripeReasonToOurs(stripeReason) {
  const map = {
    duplicate: REFUND_REASON.DUPLICATE_PAYMENT,
    fraudulent: REFUND_REASON.FRAUD_SUSPECTED,
    requested_by_customer: REFUND_REASON.CUSTOMER_REQUEST,
  };
  return map[stripeReason] || REFUND_REASON.OTHER;
}

// Fires for every refund on a charge — including ones we just created
// ourselves via stripe.refund.service.js (which also calls Stripe directly),
// so this MUST reconcile by stripe_refund_id rather than blindly re-applying
// effects, or our own admin-initiated refunds would double-count/restock here.
async function handleChargeRefunded(charge) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: charge.payment_intent });
  if (!payment) {
    logger.warn(`[stripe.webhook] charge.refunded for unknown intent ${charge.payment_intent}`);
    return;
  }

  const order = await Order.findById(payment.order);
  if (!order) return;

  // charge.refunds is a list of up to the most recent refunds on this charge
  // (present by default on the Charge object, no expand needed).
  const stripeRefunds = charge.refunds?.data || [];

  for (const sr of stripeRefunds) {
    const existing = await Refund.findOne({ stripe_refund_id: sr.id });

    if (existing) {
      // Already tracked via our own /refund endpoint — only confirm status,
      // never re-apply amount_refunded or restock a second time.
      if (existing.status !== REFUND_STATUS.SUCCEEDED && sr.status === "succeeded") {
        existing.status = REFUND_STATUS.SUCCEEDED;
        await existing.save();
      }
      continue;
    }

    // Unknown stripe_refund_id => issued directly from the Stripe dashboard,
    // bypassing our API entirely. Record it for the audit trail; no admin
    // user in our system initiated it, and no restock option was presented
    // to anyone, so stock is deliberately left untouched here — an admin can
    // restock manually via the inventory screen if the return applies.
    await Refund.create({
      payment: payment._id,
      order: order._id,
      stripe_refund_id: sr.id,
      amount: sr.amount,
      reason: mapStripeReasonToOurs(sr.reason),
      status: sr.status === "succeeded" ? REFUND_STATUS.SUCCEEDED : REFUND_STATUS.PENDING,
      initiated_via: "stripe_dashboard",
      initiated_by: null,
    });
  }

  // charge.amount_refunded is cumulative and authoritative from Stripe's
  // side — set directly (never incremented) so this handler is idempotent
  // regardless of redelivery or how many refunds (ours + dashboard) exist.
  payment.amount_refunded = charge.amount_refunded;
  await payment.save();

  order.status =
    payment.amount_refunded >= payment.amount ? ORDER_STATUS.REFUNDED : ORDER_STATUS.PARTIALLY_REFUNDED;
  await order.save();
}

module.exports = { constructEvent, handleEvent };
