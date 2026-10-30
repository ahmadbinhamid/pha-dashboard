// services/stripe/stripe.webhook.service.js
// Stripe webhooks: verify, dedupe, dispatch; ?wt= picks the tenant's secret.

const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Refund = require("../../models/Refund");
const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
const stripeKeysService = require("./stripe.keys.service");
const { syncOrderStock, DIRECTION } = require("../order-stock-sync.service");
const { getTotalPaidForOrder } = require("../payment.service");
const refundService = require("../refund.service");
const emailService = require("../email/email.service");
const { getCompanyProfile } = require("../tenant-settings.service");
const notificationService = require("../notification.service");
const { PAYMENT_STATUS, PAYMENT_PROVIDER } = require("../../constants/payment.constants");
const { ORDER_CHANNEL, ORDER_DELIVERY_METHOD, ORDER_DELIVERY_METHOD_LABEL } = require("../../constants/order.constants");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const { derivePaymentStatus } = require("../../utils/paymentStatus");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");
const { formatCentsAsDollars } = require("../../utils/currency");
const config = require("../../config");
const { logger } = require("../../loaders/logging");

// constructEvent is local HMAC, no API call; needs the tenant's signing secret.
const Stripe = require("stripe");

function constructEvent(rawBody, signatureHeader, webhookSecret) {
  return Stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

// Tries each secret (stripe listen); if all fail, throws the tenant's error.
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

// Atomic claim: E11000 means already processed, so the caller no-ops.
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
    // Release the claim so our 500 makes Stripe retry instead of skipping it.
    await StripeProcessedEvent.deleteOne({ stripe_event_id: event.id });
    throw err;
  }
}

// Checks amount/currency and saves card details; true means stop (flagged).
async function settlePayment(payment, intent, order, tenantId) {
  // Against this Payment's amount, not order.total: a balance intent is less.
  const expectedAmount = payment.amount;
  const amountReceived = intent.amount_received ?? intent.amount;
  const amountMismatch = amountReceived !== expectedAmount;
  const currencyMismatch = intent.currency !== order.currency;
  if (amountMismatch || currencyMismatch) {
    // Money was captured, so MANUAL_REVIEW; FAILED would imply none moved.
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
    return true; // do not mark paid, do not touch stock
  }

  // Re-fetch with expand for card details; Stripe rejects latest_charge nesting.
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
  return false;
}

// Pickup or delivery confirmation email, each with its own copy.
async function sendOrderConfirmationEmail(order, companyProfile) {
  const payload = {
    to: order.customer.email,
    name: order.customer.name,
    orderNumber: formatOrderNumber(order.order_number_prefix, order.order_number),
    companyProfile,
    tenantId: order.tenant_id,
  };
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  return isPickup ? emailService.sendOrderReceivedPickup(payload) : emailService.sendOrderConfirmation(payload);
}

// Display-ready order fields for the store's new-order email.
function merchantOrderView(order) {
  const ship = order.shipping_address;
  return {
    number: formatOrderNumber(order.order_number_prefix, order.order_number),
    total: formatCentsAsDollars(order.total),
    shipping: formatCentsAsDollars(order.shipping_cost || 0),
    customer_name: order.customer.company_name || order.customer.name,
    customer_email: order.customer.email || null,
    customer_phone: order.customer.phone || null,
    delivery_label: ORDER_DELIVERY_METHOD_LABEL[order.delivery_method] ?? "Delivery",
    address: ship ? `${ship.address}, ${ship.suburb} ${ship.state} ${ship.postcode}` : null,
    items: order.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      line_total: formatCentsAsDollars(item.unit_price * item.quantity - (item.discount_amount || 0)),
    })),
    order_url: `${config.emailBrand.clientUrl}/orders/${order._id}`,
  };
}

// The store's inbox is its profile email; no address means no copy.
async function sendMerchantOrderEmail(order, companyProfile) {
  if (!companyProfile?.email) {
    logger.warn(`[stripe.webhook] no store email for tenant ${order.tenant_id}; merchant copy skipped`);
    return;
  }
  await emailService.sendNewOrderToMerchant({
    to: companyProfile.email,
    order: merchantOrderView(order),
    companyProfile,
  });
}

async function handlePaymentSucceeded(intent, tenantId) {
  const payment = await Payment.findOne({ stripe_payment_intent_id: intent.id });
  if (!payment) {
    logger.error(`[stripe.webhook] payment_intent.succeeded for unknown intent ${intent.id}`);
    return;
  }
  // Done only once payment and order/stock effects both are, so retries resume.
  if (payment.status === PAYMENT_STATUS.SUCCEEDED && payment.order_effects_applied_at) return;

  // +guest_access_token for the confirmation email's "view order" link.
  const order = await Order.findById(payment.order).select("+guest_access_token");
  if (!order) {
    logger.error(`[stripe.webhook] order ${payment.order} missing for intent ${intent.id}`);
    return;
  }

  // Cross-tenant guard: never apply effects to another tenant's order.
  if (String(order.tenant_id) !== String(tenantId)) {
    logger.error(
      `[stripe.webhook] tenant mismatch on intent ${intent.id}: webhook tenant=${tenantId}, ` +
        `resolved order's tenant=${order.tenant_id} — refusing to apply effects`,
    );
    return;
  }

  // Skipped on resume; only the order/stock side below still needs finishing.
  if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
    const mismatched = await settlePayment(payment, intent, order, tenantId);
    if (mismatched) return;
  }

  // Recomputed from all payments: an earlier deposit may leave money owing.
  const totalPaidCents = await getTotalPaidForOrder(order._id);
  const derivedStatus = derivePaymentStatus(totalPaidCents, order.total);
  order.status = derivedStatus;
  // createRefund gates on payment_status, so set it, not just legacy status.
  order.payment_status = derivedStatus;

  // Manual sales deducted stock at creation; others move stock on payment.
  if (order.channel !== ORDER_CHANNEL.MANUAL) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.DEDUCT);
    if (hasShortfall) {
      order.has_stock_issue = true;
      order.stock_issue_note = note;
    }
  }

  await order.save();

  // No transaction: a crash before this redoes stock on retry; accepted risk.
  payment.order_effects_applied_at = new Date();
  await payment.save();

  logger.info(`[stripe.webhook] order ${order.order_number} marked ${order.status} (intent ${intent.id})`);

  // In-store sales are invoiced via the explicit "Send Email" button instead.
  if (order.channel === ORDER_CHANNEL.MANUAL) return;

  // Best-effort, and only here, so abandoned checkouts never notify.
  try {
    await notificationService.notifyNewOrder(order.tenant_id, order);
  } catch (err) {
    logger.error(`[stripe.webhook] failed to notify new order ${order.order_number}`, { error: err.message });
  }

  // Best-effort: payment is already SUCCEEDED, so redelivery wouldn't resend.
  let companyProfile = null;
  try {
    companyProfile = await getCompanyProfile(order.tenant_id);
    await sendOrderConfirmationEmail(order, companyProfile);
  } catch (err) {
    logger.error(`[stripe.webhook] failed to send order confirmation email for ${order.order_number}`, {
      error: err.message,
    });
  }

  // Separate try: a failed customer email must not cost the store its copy.
  try {
    await sendMerchantOrderEmail(order, companyProfile ?? (await getCompanyProfile(order.tenant_id)));
  } catch (err) {
    logger.error(`[stripe.webhook] failed to email the store about ${order.order_number}`, { error: err.message });
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
  // Order stays pending_payment; the storefront can retry on the same intent.
}

// Stripe's refund reasons differ from ours; only for dashboard refunds.
function mapStripeReasonToOurs(stripeReason) {
  const map = {
    duplicate: REFUND_REASON.DUPLICATE_PAYMENT,
    fraudulent: REFUND_REASON.FRAUD_SUSPECTED,
    requested_by_customer: REFUND_REASON.CUSTOMER_REQUEST,
  };
  return map[stripeReason] || REFUND_REASON.OTHER;
}

// Every refund on the charge, ours too: reconcile by stripe_refund_id.
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

  // charge.refunds isn't reliably expanded (account API version): re-fetch.
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
    // Ours already: confirm settlement only; effects_applied_at blocks reruns.
    const allocation = existing.payment_allocations.find((a) => a.stripe_refund_id === sr.id);
    if (allocation && !allocation.settled && sr.status === "succeeded") {
      allocation.settled = true;
      await existing.save();
    }
    const allSettled = existing.payment_allocations.every((a) => a.settled);
    if (allSettled && existing.status === REFUND_STATUS.PROCESSING) {
      // Save SUCCEEDED before applyRefundEffects, or its recompute skips it.
      existing.status = REFUND_STATUS.SUCCEEDED;
      await existing.save();
      await refundService.applyRefundEffects(existing._id);
    }
    return;
  }

  // Unknown id = Stripe dashboard refund: amount-only, flagged, no restock.
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

// data.object is the Refund itself; needs charge.refund.updated enabled.
async function handleChargeRefundUpdated(sr, tenantId) {
  if (sr.status !== "failed" && sr.status !== "canceled") return; // only a reversal is actionable here

  const refund = await Refund.findOne({ "payment_allocations.stripe_refund_id": sr.id });
  if (!refund) {
    logger.warn(`[stripe.webhook] charge.refund.updated for unknown stripe refund ${sr.id}`);
    return;
  }

  // Tenant check only when given; the reconciliation sweep passes none.
  if (tenantId != null && String(refund.tenant_id) !== String(tenantId)) {
    logger.error(
      `[stripe.webhook] tenant mismatch on charge.refund.updated for stripe refund ${sr.id}: ` +
        `webhook tenant=${tenantId}, resolved refund's tenant=${refund.tenant_id} — refusing to apply effects`,
    );
    return;
  }

  if (!refund.effects_applied_at) {
    // Never applied, so nothing to reverse; just record that it failed.
    refund.status = REFUND_STATUS.FAILED;
    refund.failure_reason = `Stripe refund ${sr.status}`;
    await refund.save();
    logger.error(
      `[stripe.webhook] refund ${refund.refund_number} failed at Stripe (${sr.status}) before its effects were ever applied`,
    );
    return;
  }

  // Stripe reversed a settled refund: auto-void (stripe_reversal) and alert.
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
  // Exported for the stuck-refund sweep, which reuses these handlers.
  reconcileStripeRefund,
  handleChargeRefundUpdated,
};
