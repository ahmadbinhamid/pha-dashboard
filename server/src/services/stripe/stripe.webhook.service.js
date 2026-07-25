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
const { getTotalPaidForOrder } = require("../payment.service");
const emailService = require("../email/email.service");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const { derivePaymentStatus } = require("../../utils/paymentStatus");
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

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        return await handlePaymentSucceeded(event.data.object);
      case "payment_intent.payment_failed":
        return await handlePaymentFailed(event.data.object);
      case "charge.refunded":
        return await handleChargeRefunded(event.data.object);
      default:
        logger.info(`[stripe.webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Processing failed after the claim was already made — release it so
    // the 500 we return causes Stripe to retry this same event instead of
    // it being silently treated as "already handled" forever.
    await StripeProcessedEvent.deleteOne({ stripe_event_id: event.id });
    throw err;
  }
}

async function handlePaymentSucceeded(intent) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  if (!payment) {
    logger.error(`[stripe.webhook] payment_intent.succeeded for unknown intent ${intent.id}`);
    return;
  }
  if (payment.status === PAYMENT_STATUS.SUCCEEDED) return; // already handled

  // +guest_access_token: needed to build the customer-facing "view order"
  // link in the confirmation email below — excluded by default (select: false).
  const order = await Order.findById(payment.order).select("+guest_access_token");
  if (!order) {
    logger.error(`[stripe.webhook] order ${payment.order} missing for intent ${intent.id}`);
    return;
  }

  // Trust nothing from the intent except what Stripe says was actually
  // captured — verify it matches what we billed for before marking paid.
  // Compared against this Payment doc's own `amount` (what we told Stripe to
  // charge when the intent was created), NOT order.total — an intent for a
  // manual sale's remaining balance is legitimately less than the total.
  const expectedAmount = payment.amount;
  const amountReceived = intent.amount_received ?? intent.amount;
  const amountMismatch = amountReceived !== expectedAmount;
  const currencyMismatch = intent.currency !== order.currency;
  if (amountMismatch || currencyMismatch) {
    // Funds were captured (this event only fires on success) — FAILED would
    // wrongly imply no money moved, so flag for manual review instead.
    payment.status = PAYMENT_STATUS.MANUAL_REVIEW;
    payment.failure_reason = [
      amountMismatch ? `Amount mismatch: received ${amountReceived}, expected ${expectedAmount}` : null,
      currencyMismatch ? `Currency mismatch: received ${intent.currency}, expected ${order.currency}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    await payment.save();
    logger.error(
      `[stripe.webhook] MISMATCH order ${order.order_number}: ${payment.failure_reason} — needs manual review`,
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

  // Recomputed across every succeeded payment on the order, not hardcoded to
  // PAID — this same webhook fires for a manual sale's payment-link
  // remainder too, where a prior deposit means this payment might not be
  // the last money owed... though in practice it always is, since nothing
  // else currently lets more than one payment attempt be in flight at once.
  const totalPaidCents = await getTotalPaidForOrder(order._id);
  order.status = derivePaymentStatus(totalPaidCents, order.total);

  // Manual/in-store sales already had their stock deducted in full at
  // creation time (the goods left with the customer then, regardless of how
  // much was actually collected) — deducting again here on a payment-link
  // top-up would double-count it. Only storefront/eBay orders wait for a
  // Stripe payment to confirm before stock ever moves.
  if (order.channel !== ORDER_CHANNEL.MANUAL) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.DEDUCT);
    if (hasShortfall) {
      order.has_stock_issue = true;
      order.stock_issue_note = note;
    }
  }

  await order.save();

  logger.info(`[stripe.webhook] order ${order.order_number} marked ${order.status} (intent ${intent.id})`);

  // Manual/in-store sales get their invoice via the explicit "Send Email"
  // button (order.service.js#sendOrderNotification) — never this automatic
  // storefront-checkout confirmation, which assumes a storefront/eBay order
  // shape (e.g. sendOrderConfirmation's copy) that doesn't fit an in-person sale.
  if (order.channel === ORDER_CHANNEL.MANUAL) return;

  // Best-effort — never let an email hiccup fail this webhook. Throwing here
  // would make handleEvent release the processed-event claim and cause
  // Stripe to redeliver, but payment.status is already SUCCEEDED by then, so
  // the retry would short-circuit above and this email would never resend
  // anyway. Log and move on instead.
  try {
    const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
    if (isPickup) {
      await emailService.sendOrderReceivedPickup({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: order.order_number,
      });
    } else {
      await emailService.sendOrderConfirmation({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: order.order_number,
      });
    }
  } catch (err) {
    logger.error(`[stripe.webhook] failed to send order confirmation email for ${order.order_number}`, {
      error: err.message,
    });
  }
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

  // charge.refunds is NOT auto-expanded on the Charge object as of Stripe API
  // version 2022-11-15+ — and the payload shape follows the API version
  // configured on the Stripe account/webhook endpoint, not our SDK-pinned
  // apiVersion, so charge.refunds?.data can be silently absent here even
  // though our code is pinned to a version that (in the SDK docs) still
  // shows it. Never rely on optional sub-objects being present in webhook
  // payloads — re-fetch explicitly instead.
  const stripe = getStripeClient();
  const { data: stripeRefunds } = await stripe.refunds.list({ payment_intent: charge.payment_intent });

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
    //
    // Edge case: if sr.status is not yet "succeeded" here (status=PENDING
    // below) while one of our own admin refunds for this same payment is
    // also mid-flight, this create() can collide with the partial unique
    // index on Refund{payment, status:pending} (see Refund model) and throw
    // E11000. handleEvent releases the processed-event claim on any thrown
    // error, so Stripe simply retries this charge.refunded delivery — it
    // self-heals once our own admin refund finishes and stops holding the
    // "pending" slot. If you see repeated retries of the same charge.refunded
    // event in the Stripe dashboard, check for a concurrent admin-initiated
    // refund on the same payment before assuming something is actually broken.
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
