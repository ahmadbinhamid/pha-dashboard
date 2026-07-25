// utils/paymentStatus.js

const { ORDER_STATUS } = require("../constants/order.constants");

// Pure — callers own fetching whatever "total paid so far" figure they pass
// in (see payment.service.js#getTotalPaidForOrder for the DB-backed sum
// across every succeeded Payment on an order).
function derivePaymentStatus(totalPaidCents, orderTotalCents) {
  if (totalPaidCents <= 0) return ORDER_STATUS.PENDING_PAYMENT;
  if (totalPaidCents >= orderTotalCents) return ORDER_STATUS.PAID;
  return ORDER_STATUS.PARTIALLY_PAID;
}

module.exports = { derivePaymentStatus };
