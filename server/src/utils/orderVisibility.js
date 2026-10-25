// utils/orderVisibility.js
// Query filters deciding which orders staff-facing lists and stats count.

const {
  ORDER_CHANNEL,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
  UNPAID_ORDER_PAYMENT_STATUSES,
} = require("../constants/order.constants");

// Unpaid storefront orders are checkout attempts, not sales, until Stripe pays.
function excludeAbandonedCheckouts() {
  return { $nor: [{ channel: ORDER_CHANNEL.STOREFRONT, payment_status: ORDER_PAYMENT_STATUS.PENDING_PAYMENT }] };
}

// A cancelled order owes nothing, so it never counts as awaiting payment.
const notCancelled = () => ({ fulfillment_status: { $ne: ORDER_FULFILLMENT_STATUS.CANCELLED } });

function awaitingPayment() {
  return { payment_status: { $in: UNPAID_ORDER_PAYMENT_STATUSES }, ...notCancelled() };
}

// Account invoice past its due date with money still owing.
function overdueInvoices(now = new Date()) {
  return { ...awaitingPayment(), due_date: { $lt: now } };
}

module.exports = { excludeAbandonedCheckouts, notCancelled, awaitingPayment, overdueInvoices };
