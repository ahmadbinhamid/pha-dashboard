// services/refund.service.js
//
// Provider-agnostic refund bookkeeping shared by the Stripe refund flow
// (services/stripe/stripe.refund.service.js) and the manual refund flow
// below — so a Refund doc, a payment's amount_refunded, and the order's
// status can never drift between the two entry points.

const Refund = require("../models/Refund");
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { syncOrderStock, DIRECTION } = require("./order-stock-sync.service");
const { REFUND_REASON, REFUND_STATUS } = require("../constants/refund.constants");
const { PAYMENT_STATUS, PAYMENT_PROVIDER } = require("../constants/payment.constants");
const { ORDER_STATUS } = require("../constants/order.constants");
const { logger } = require("../loaders/logging");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Guards shared by both refund entry points: the payment must exist, be
// succeeded, and have enough remaining balance to cover `amount`.
async function loadRefundablePayment(paymentId, amount) {
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

  return { payment, remaining, isFullRefund: amount === remaining };
}

// Marks a pending Refund doc succeeded (recording the Stripe refund id when
// there is one), debits the payment, and recomputes the order's status —
// optionally restocking on a full refund. Called once the refund has
// actually succeeded, whether that took a Stripe API round-trip or (for a
// manual refund) nothing at all.
async function finalizeSucceededRefund({ refund, payment, order, amount, isFullRefund, restock, reason, stripeRefundId }) {
  if (stripeRefundId) refund.stripe_refund_id = stripeRefundId;
  refund.status = REFUND_STATUS.SUCCEEDED;
  await refund.save();

  payment.amount_refunded += amount;
  await payment.save();

  const isNowFullyRefunded = payment.amount_refunded >= payment.amount;
  order.status = isNowFullyRefunded ? ORDER_STATUS.REFUNDED : ORDER_STATUS.PARTIALLY_REFUNDED;

  // Restock only on a full refund, and only when the admin asked for it
  // (explicit restock:true) or it's the default order-cancelled case — a
  // partial/goodwill refund never implies units are physically coming back.
  const shouldRestock = isFullRefund && (restock || reason === REFUND_REASON.ORDER_CANCELLED);
  if (shouldRestock) {
    const { hasShortfall, note } = await syncOrderStock(order, DIRECTION.RESTOCK);
    if (hasShortfall) {
      logger.warn(`[refund] restock issue for order ${order.order_number}: ${note}`);
    }
  }

  await order.save();
  return refund;
}

// Records a refund for a payment with no gateway to actually call — a
// manual sale (cash/online transfer/EFPOS) or an eBay-collected order (paid
// through eBay's own managed payments, not ours) — so this is purely a DB
// record: staff hand the amount back outside the system (or eBay does, on
// their end), and this just accounts for that against the payment/order.
// Succeeds immediately, no pending intermediate state (that only exists for
// the async Stripe call).
async function createManualRefund({ paymentId, amount, reason, initiatedBy }) {
  const { payment, isFullRefund } = await loadRefundablePayment(paymentId, amount);
  if (payment.provider === PAYMENT_PROVIDER.STRIPE) {
    throw httpError("This payment was collected via Stripe — use the Stripe refund action instead", 400);
  }

  const refund = await Refund.create({
    payment: payment._id,
    order: payment.order,
    amount,
    reason,
    status: REFUND_STATUS.PENDING,
    initiated_via: "manual",
    initiated_by: initiatedBy,
  });

  const order = await Order.findById(payment.order);

  return finalizeSucceededRefund({ refund, payment, order, amount, isFullRefund, restock: false, reason });
}

module.exports = { httpError, loadRefundablePayment, finalizeSucceededRefund, createManualRefund };
