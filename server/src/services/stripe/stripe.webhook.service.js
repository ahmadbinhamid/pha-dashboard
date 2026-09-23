// services/stripe/stripe.webhook.service.js
// Signature verification, idempotency, and event dispatch for Stripe webhooks, mirroring
// ebay.webhook.service.js's shape. BYOK: the tenant is resolved from an opaque `?wt=` token
// before signature verification, so the right tenant's webhook secret verifies it.

const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Refund = require("../../models/Refund");
const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
const stripeKeysService = require("./stripe.keys.service");
const { syncOrderStock, DIRECTION } = require("../order-stock-sync.service");
const { getTotalPaidForOrder } = require("../payment.service");
const refundService = require("../refund.service");
const emailService = require("../email/email.service");
const { getCompanyProfile } = require("../tenantSettings.service");
const notificationService = require("../notification.service");
const { PAYMENT_STATUS, PAYMENT_PROVIDER } = require("../../constants/payment.constants");
const { ORDER_CHANNEL, ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const { derivePaymentStatus } = require("../../utils/paymentStatus");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");
const { logger } = require("../../loaders/logging");

// constructEvent is pure HMAC verification, no API call — just the tenant's webhook signing secret.
const Stripe = require("stripe");

function constructEvent(rawBody, signatureHeader, webhookSecret) {
  return Stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

// Verifies against each candidate secret in order (for local `stripe listen` testing); throws
// the first candidate's error if all fail, since that's the tenant's real secret.
function constructEventWithFallback(rawBody, signatureHeader, candidateSecrets) {
  let firstError;
  for (const secret of candidateSecrets.filter(Boolean)) {
    try {
      return constructEvent(rawBody, signatureHeader, secret);
    } catch (err) {
      firstError = firstError || err;
    }
  }
  throw firstError || new Error("No webhook secret configured");
}

// Atomic claim: E11000 means already processed, treated by the caller as a no-op.
async function claimEvent(event, tenantId) {
  try {
    await StripeProcessedEvent.create({
      stripe_event_id: event.id,
      type: event.type,
      tenant_id: tenantId,
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

async function handleEvent(event, tenantId) {
  const isNew = await claimEvent(event, tenantId);
  if (!isNew) {
    logger.info(`[stripe.webhook] duplicate event ignored: ${event.id} (${event.type})`);
    return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        return await handlePaymentSucceeded(event.data.object, tenantId);
      case "payment_intent.payment_failed":
        return await handlePaymentFailed(event.data.object);
      case "charge.refunded":
        return await handleChargeRefunded(event.data.object, tenantId);
      case "charge.refund.updated":
        return await handleChargeRefundUpdated(event.data.object, tenantId);
      default:
        logger.info(`[stripe.webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Release the claim so our 500 causes Stripe to retry, instead of treating this as handled forever.
    await StripeProcessedEvent.deleteOne({ stripe_event_id: event.id });
    throw err;
  }
}

async function handlePaymentSucceeded(intent, tenantId) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  if (!payment) {
    logger.error(`[stripe.webhook] payment_intent.succeeded for unknown intent ${intent.id}`);
    return;
  }
  // Fully handled only when both the payment record and order/stock effects are done — status
  // alone let a retry after a failed order.save() get stuck permanently at pending_payment.
  if (payment.status === PAYMENT_STATUS.SUCCEEDED && payment.order_effects_applied_at) return;

  // +guest_access_token needed for the "view order" link in the confirmation email below.
  const order = await Order.findById(payment.order).select("+guest_access_token");
  if (!order) {
    logger.error(`[stripe.webhook] order ${payment.order} missing for intent ${intent.id}`);
    return;
  }

  // Defense-in-depth: confirms the resolved order's tenant matches the webhook's tenant,
  // catching a misconfigured webhook before it applies effects to the wrong tenant's order.
  if (String(order.tenant_id) !== String(tenantId)) {
    logger.error(
      `[stripe.webhook] tenant mismatch on intent ${intent.id}: webhook tenant=${tenantId}, ` +
        `resolved order's tenant=${order.tenant_id} — refusing to apply effects`,
    );
    return;
  }

  // Skipped entirely on a resume — only the order/stock side below still needs finishing.
  if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
    // Verify the captured amount matches this Payment doc's own `amount`, not order.total —
    // an intent for a manual sale's remaining balance is legitimately less than the total.
    const expectedAmount = payment.amount;
    const amountReceived = intent.amount_received ?? intent.amount;
    const amountMismatch = amountReceived !== expectedAmount;
    const currencyMismatch = intent.currency !== order.currency;
    if (amountMismatch || currencyMismatch) {
      // Funds were captured — FAILED would wrongly imply no money moved, so flag for review instead.
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

    // Re-retrieve with expand to read card details — Stripe rejects nesting through `latest_charge`.
    const stripe = await stripeKeysService.getStripeClient(tenantId);
    const fullIntent = await stripe.paymentIntents.retrieve(intent.id, { expand: ["payment_method"] });
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
  }

  // Recomputed across every succeeded payment, not hardcoded to PAID, since a prior deposit
  // means this payment might not be the last money owed.
  const totalPaidCents = await getTotalPaidForOrder(order._id);
  const derivedStatus = derivePaymentStatus(totalPaidCents, order.total);
  order.status = derivedStatus;
  // payment_status is what createRefund actually gates on — this webhook previously only wrote
  // the legacy `status` field, leaving payment_status stuck at pending_payment forever.
  order.payment_status = derivedStatus;

  // Manual/in-store sales already deducted stock in full at creation time; only storefront/eBay
  // orders wait for a Stripe payment to confirm before stock moves.
  if (order.channel !== ORDER_CHANNEL.MANUAL) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.DEDUCT);
    if (hasShortfall) {
      order.has_stock_issue = true;
      order.stock_issue_note = note;
    }
  }

  await order.save();

  // Marks order/stock effects as durably complete. No transaction spans this and order.save()
  // above; a crash in that narrow window would redo the stock deduction on retry — accepted trade-off.
  payment.order_effects_applied_at = new Date();
  await payment.save();

  logger.info(`[stripe.webhook] order ${order.order_number} marked ${order.status} (intent ${intent.id})`);

  // Manual/in-store sales get their invoice via the explicit "Send Email" button instead.
  if (order.channel === ORDER_CHANNEL.MANUAL) return;

  // Best-effort — a broken notification pipeline must never fail this webhook. This is the only
  // place storefront orders get notified, deferred until payment succeeds so an abandoned checkout doesn't.
  try {
    await notificationService.notifyNewOrder(order.tenant_id, order);
  } catch (err) {
    logger.error(`[stripe.webhook] failed to notify new order ${order.order_number}`, { error: err.message });
  }

  // Best-effort — throwing here would make handleEvent release the claim and Stripe redeliver,
  // but payment.status is already SUCCEEDED so the email would never resend anyway.
  try {
    const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
    const companyProfile = await getCompanyProfile(order.tenant_id);
    if (isPickup) {
      await emailService.sendOrderReceivedPickup({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number),
        companyProfile,
        tenantId: order.tenant_id,
      });
    } else {
      await emailService.sendOrderConfirmation({
        to: order.customer.email,
        name: order.customer.name,
        orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number),
        companyProfile,
        tenantId: order.tenant_id,
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

// Stripe's refund `reason` values don't line up with ours; used only for dashboard-issued refunds.
function mapStripeReasonToOurs(stripeReason) {
  const map = {
    duplicate: REFUND_REASON.DUPLICATE_PAYMENT,
    fraudulent: REFUND_REASON.FRAUD_SUSPECTED,
    requested_by_customer: REFUND_REASON.CUSTOMER_REQUEST,
  };
  return map[stripeReason] || REFUND_REASON.OTHER;
}

// Fires for every refund on a charge, including our own admin-initiated ones, so this must
// reconcile by stripe_refund_id rather than blindly re-applying effects. Lists refunds for the
// intent (unlike handleChargeRefundUpdated below) since charge.refunds isn't reliably expanded
// and one event can cover several refunds.
async function handleChargeRefunded(charge, tenantId) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: charge.payment_intent });
  if (!payment) {
    logger.warn(`[stripe.webhook] charge.refunded for unknown intent ${charge.payment_intent}`);
    return;
  }

  const order = await Order.findById(payment.order);
  if (!order) return;

  if (String(order.tenant_id) !== String(tenantId)) {
    logger.error(
      `[stripe.webhook] tenant mismatch on charge.refunded for intent ${charge.payment_intent}: ` +
        `webhook tenant=${tenantId}, resolved order's tenant=${order.tenant_id} — refusing to apply effects`,
    );
    return;
  }

  // charge.refunds isn't reliably auto-expanded on the webhook payload (follows the account's
  // configured API version, not our SDK-pinned one) — re-fetch explicitly instead.
  const stripe = await stripeKeysService.getStripeClient(tenantId);
  const { data: stripeRefunds } = await stripe.refunds.list({ payment_intent: charge.payment_intent });

  for (const sr of stripeRefunds) {
    await reconcileStripeRefund(sr, payment, order);
  }
}

// One Stripe refund object reconciled against our Refund collection.
async function reconcileStripeRefund(sr, payment, order) {
  const existing = await Refund.findOne({ "payment_allocations.stripe_refund_id": sr.id });

  if (existing) {
    // Already tracked via our own createRefund — only confirm settlement, never re-apply
    // effects (guarded by effects_applied_at so redelivery can't double-run the restock/eBay leg).
    const allocation = existing.payment_allocations.find((a) => a.stripe_refund_id === sr.id);
    if (allocation && !allocation.settled && sr.status === "succeeded") {
      allocation.settled = true;
      await existing.save();
    }
    const allSettled = existing.payment_allocations.every((a) => a.settled);
    if (allSettled && existing.status === REFUND_STATUS.PROCESSING) {
      // status = SUCCEEDED must be saved before applyRefundEffects runs, or its own recompute
      // silently excludes this refund's contribution (reordering broke refund.service.concurrency.test.js).
      existing.status = REFUND_STATUS.SUCCEEDED;
      await existing.save();
      await refundService.applyRefundEffects(existing._id);
    }
    return;
  }

  // Unknown stripe_refund_id => issued directly from the Stripe dashboard. Recorded as
  // scope: "amount" with needs_reconciliation: true; stock is left untouched since no restock
  // option was ever presented. Guarded by the unique index on stripe_refund_id, not read-then-act.
  let created;
  try {
    const refundNumber = await refundService.nextRefundNumber(order.tenant_id);
    created = await Refund.create({
      tenant_id: order.tenant_id,
      order: order._id,
      payment: payment._id, // legacy field, kept populated during transition
      amount: sr.amount,
      reason: mapStripeReasonToOurs(sr.reason),
      status: sr.status === "succeeded" ? REFUND_STATUS.SUCCEEDED : REFUND_STATUS.PROCESSING,
      initiated_via: "stripe_dashboard",
      initiated_by: null,
      refund_number: refundNumber,
      scope: "amount",
      lines: [],
      items_amount: 0,
      gst_amount: Math.round(sr.amount / 11),
      total_amount: sr.amount,
      payment_allocations: [
        {
          payment: payment._id,
          amount: sr.amount,
          provider: PAYMENT_PROVIDER.STRIPE,
          stripe_refund_id: sr.id,
          settled: sr.status === "succeeded",
        },
      ],
      needs_reconciliation: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      logger.info(`[stripe.webhook] concurrent charge.refunded delivery already recorded refund for ${sr.id}`);
      return;
    }
    throw err;
  }

  if (created.status === REFUND_STATUS.SUCCEEDED) {
    await refundService.applyRefundEffects(created._id);
  }
}

// event.data.object here is the Stripe Refund object itself, so no list() call needed. Requires
// enabling charge.refund.updated on the Stripe webhook endpoint's Dashboard configuration.
async function handleChargeRefundUpdated(sr, tenantId) {
  if (sr.status !== "failed" && sr.status !== "canceled") return; // only a reversal is actionable here

  const refund = await Refund.findOne({ "payment_allocations.stripe_refund_id": sr.id });
  if (!refund) {
    logger.warn(`[stripe.webhook] charge.refund.updated for unknown stripe refund ${sr.id}`);
    return;
  }

  // Same defense-in-depth check as handlePaymentSucceeded/handleChargeRefunded, but only
  // enforced when tenantId was actually supplied — refund.reconciliation.service.js also calls
  // this directly with no tenantId, via its own trusted DB lookup with nothing to cross-check.
  if (tenantId != null && String(refund.tenant_id) !== String(tenantId)) {
    logger.error(
      `[stripe.webhook] tenant mismatch on charge.refund.updated for stripe refund ${sr.id}: ` +
        `webhook tenant=${tenantId}, resolved refund's tenant=${refund.tenant_id} — refusing to apply effects`,
    );
    return;
  }

  if (!refund.effects_applied_at) {
    // Never actually applied — nothing to reverse, just record that it didn't go through.
    refund.status = REFUND_STATUS.FAILED;
    refund.failure_reason = `Stripe refund ${sr.status}`;
    await refund.save();
    logger.error(
      `[stripe.webhook] refund ${refund.refund_number} failed at Stripe (${sr.status}) before its effects were ever applied`,
    );
    return;
  }

  // Effects were already applied and Stripe itself reversed the refund afterward — auto-reverse
  // via the same void path an admin would use, and alert loudly. source: "stripe_reversal" is the
  // one legitimate exception to voidRefund's "never void a settled Stripe refund" guard, since
  // Stripe is reporting the money genuinely came back.
  await refundService.voidRefund(
    refund._id,
    {
      reason: `Auto-reversed: Stripe refund ${sr.id} transitioned to ${sr.status} after effects were already applied`,
      userId: null,
      source: "stripe_reversal",
    },
    refund.tenant_id,
  );
  logger.error(
    `[stripe.webhook] ALERT: refund ${refund.refund_number} (order ${refund.order}) was auto-reversed — ` +
      `Stripe's refund ${sr.id} moved to "${sr.status}" after we had already credited the customer and/or ` +
      `restocked. Review this order manually.`,
  );
}

module.exports = {
  constructEvent,
  constructEventWithFallback,
  handleEvent,
  // Exported for refund.reconciliation.service.js's stuck-refund sweep, which reuses these
  // same handlers rather than duplicating their logic.
  reconcileStripeRefund,
  handleChargeRefundUpdated,
};
