// utils/paymentStatus.js

const { ORDER_STATUS, ORDER_PAYMENT_STATUS } = require("../constants/order.constants");

// Pure — callers own fetching whatever "total paid so far" figure they pass
// in (see payment.service.js#getTotalPaidForOrder for the DB-backed sum
// across every succeeded Payment on an order).
function derivePaymentStatus(totalPaidCents, orderTotalCents) {
  if (totalPaidCents <= 0) return ORDER_STATUS.PENDING_PAYMENT;
  if (totalPaidCents >= orderTotalCents) return ORDER_STATUS.PAID;
  return ORDER_STATUS.PARTIALLY_PAID;
}

// Derives the legacy `status` field as a rollup of the two real, independent
// fields — completed (and not refunded) wins, then cancelled, else it just
// mirrors payment progress. Extracted from refund.service.js#recomputeLedger
// (the original site this rule was written for) so order.service.js's
// updateOrderStatus can apply the exact same rule when fulfillment_status
// changes outside a refund. See Order.js's `status` field comment for why
// this rollup exists instead of retiring the field outright.
function deriveLegacyOrderStatus(fulfillmentStatus, paymentStatus) {
  if (
    fulfillmentStatus === "completed" &&
    paymentStatus !== ORDER_PAYMENT_STATUS.REFUNDED &&
    paymentStatus !== ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED
  ) {
    return ORDER_STATUS.FULFILLED;
  }
  if (fulfillmentStatus === "cancelled") return ORDER_STATUS.CANCELLED;
  return paymentStatus;
}

module.exports = { derivePaymentStatus, deriveLegacyOrderStatus };
