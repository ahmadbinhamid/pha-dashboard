// constants/order.constants.js

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  // Part of the total collected, e.g. a deposit with the rest still due.
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

// Where an order came from; every channel shares one collection.
const ORDER_CHANNEL = Object.freeze({
  STOREFRONT: "storefront",
  EBAY: "ebay",
  // Counter sale created by staff in the dashboard.
  MANUAL: "manual",
});

// How the order reaches the customer; pickup has no address or shipping.
const ORDER_DELIVERY_METHOD = Object.freeze({
  DELIVERY: "delivery",
  PICKUP: "pickup",
});

// Order-level payment position; PAYMENT_STATUS is one Payment's lifecycle.
const ORDER_PAYMENT_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

// Staff-editable lifecycle, independent of ORDER_PAYMENT_STATUS.
const ORDER_FULFILLMENT_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

// Orders with money still owing: an outstanding invoice.
const UNPAID_ORDER_STATUSES = Object.freeze([ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID]);

module.exports = {
  ORDER_STATUS,
  UNPAID_ORDER_STATUSES,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
};
