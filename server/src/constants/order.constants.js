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

// Title cap for custom (order-only) lines entered at POS.
const CUSTOM_ORDER_ITEM_NAME_MAX = 200;

// jsonerr.code on a 409 from an order edit, so the client can explain it.
const ORDER_EDIT_CONFLICT = Object.freeze({
  NOT_EDITABLE: "not_editable",
  PAYMENT_IN_FLIGHT: "payment_in_flight",
  PAYMENT_CHECK_FAILED: "payment_check_failed",
  VERSION_CONFLICT: "version_conflict",
});

module.exports = {
  ORDER_EDIT_CONFLICT,
  ORDER_STATUS,
  CUSTOM_ORDER_ITEM_NAME_MAX,
  UNPAID_ORDER_STATUSES,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
};
