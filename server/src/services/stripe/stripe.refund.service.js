// services/stripe/stripe.refund.service.js

const Refund = require("../../models/Refund");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const { getStripeClient } = require("./stripe.client.service");
const { syncOrderStock, DIRECTION } = require("../order-stock-sync.service");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const { PAYMENT_STATUS } = require("../../constants/payment.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { logger } = require("../../loaders/logging");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Stripe's refund `reason` only accepts a few literal values distinct from
// ours; map what we can, default the rest to "requested_by_customer".
function mapReasonToStripe(reason) {
  const map = {
    [REFUND_REASON.DUPLICATE_PAYMENT]: "duplicate",
    [REFUND_REASON.FRAUD_SUSPECTED]: "fraudulent",
  };
  return map[reason] || "requested_by_customer";
}

async function createRefund({ paymentId, amount, reason, initiatedBy, restock = false }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw httpError("Payment not found", 404);
  }
  if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
    throw httpError("Only a succeeded payment can be refunded", 400);
  }

  const remaining = payment.amount - payment.amount_refunded;
  if (!Number.isInteger(amount) || amount < 1 || amount > remaining) {
    throw httpError(`Refund amount must be between 1 and ${remaining} cents`, 400);
  }

  const isFullRefund = amount === remaining;
  if (restock && !isFullRefund) {
    // Restocking a partial refund would require per-item quantities we don't
    // collect here — rather than guess, require a full refund for restock:true.
    throw httpError("restock is only supported when refunding the full remaining amount", 400);
  }

  // Block double-submits: only one refund attempt may be in flight per payment.
  const existingPending = await Refund.findOne({
    payment: payment._id,
    status: REFUND_STATUS.PENDING,
  });
  if (existingPending) {
    throw httpError("A refund is already pending for this payment", 409);
  }

  const refund = await Refund.create({
    payment: payment._id,
    order: payment.order,
    amount,
    reason,
    status: REFUND_STATUS.PENDING,
    initiated_via: "admin_api",
    initiated_by: initiatedBy,
  });

  const stripe = getStripeClient();

  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount,
        reason: mapReasonToStripe(reason),
      },
      { idempotencyKey: `refund_${refund._id.toString()}` },
    );
  } catch (err) {
    // No Refund doc is left stuck in "pending" — mark it failed with the
    // Stripe error recorded for the audit trail.
    refund.status = REFUND_STATUS.FAILED;
    refund.failure_reason = err.message;
    await refund.save();
    throw httpError(`Stripe refund failed: ${err.message}`, 502);
  }

  refund.stripe_refund_id = stripeRefund.id;
  refund.status = REFUND_STATUS.SUCCEEDED;
  await refund.save();

  payment.amount_refunded += amount;
  await payment.save();

  const order = await Order.findById(payment.order);
  const isNowFullyRefunded = payment.amount_refunded >= payment.amount;
  order.status = isNowFullyRefunded ? ORDER_STATUS.REFUNDED : ORDER_STATUS.PARTIALLY_REFUNDED;

  // Restock only on a full refund, and only when the admin asked for it
  // (explicit restock:true) or it's the default order-cancelled case — a
  // partial/goodwill refund never implies units are physically coming back.
  const shouldRestock = isFullRefund && (restock || reason === REFUND_REASON.ORDER_CANCELLED);
  if (shouldRestock) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.RESTOCK);
    if (hasShortfall) {
      logger.warn(`[stripe.refund] restock issue for order ${order.order_number}: ${note}`);
    }
  }

  await order.save();

  return refund;
}

module.exports = { createRefund };
