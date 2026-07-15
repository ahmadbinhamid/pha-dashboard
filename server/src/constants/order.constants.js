// constants/order.constants.js

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

module.exports = { ORDER_STATUS };
