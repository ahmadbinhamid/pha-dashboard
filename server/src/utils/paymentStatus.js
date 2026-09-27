// utils/paymentStatus.js

const { ORDER_STATUS, ORDER_PAYMENT_STATUS } = require("../constants/order.constants");

// Pure; caller supplies totalPaid (see payment.service.js#getTotalPaidForOrder).
function derivePaymentStatus(totalPaidCents, orderTotalCents) {
  if (totalPaidCents <= 0) return ORDER_STATUS.PENDING_PAYMENT;
  if (totalPaidCents >= orderTotalCents) return ORDER_STATUS.PAID;
  return ORDER_STATUS.PARTIALLY_PAID;
}

// Derives the legacy status rollup from fulfillment+payment status; shared with refund.service.js's rule.
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
