// services/stripe/stripe.refund.service.js

const Refund = require("../../models/Refund");
const Order = require("../../models/Order");
const { getStripeClient } = require("./stripe.client.service");
const { loadRefundablePayment, finalizeSucceededRefund, httpError } = require("../refund.service");
const { REFUND_REASON, REFUND_STATUS } = require("../../constants/refund.constants");
const { PAYMENT_PROVIDER } = require("../../constants/payment.constants");

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
  const { payment, isFullRefund } = await loadRefundablePayment(paymentId, amount);
  if (payment.provider !== PAYMENT_PROVIDER.STRIPE) {
    throw httpError("This payment was collected manually and cannot be refunded via Stripe", 400);
  }

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

  let refund;
  try {
    refund = await Refund.create({
      payment: payment._id,
      order: payment.order,
      amount,
      reason,
      status: REFUND_STATUS.PENDING,
      initiated_via: "admin_api",
      initiated_by: initiatedBy,
    });
  } catch (err) {
    // Lost a race with a concurrent refund request for the same payment —
    // the findOne check above is read-then-act, so this partial unique
    // index (see Refund model) is what actually closes the race.
    if (err.code === 11000) {
      throw httpError("A refund is already pending for this payment", 409);
    }
    throw err;
  }

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

  const order = await Order.findById(payment.order);

  return finalizeSucceededRefund({
    refund,
    payment,
    order,
    amount,
    isFullRefund,
    restock,
    reason,
    stripeRefundId: stripeRefund.id,
  });
}

module.exports = { createRefund };
