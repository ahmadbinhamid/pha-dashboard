// constants/order.constants.js

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  // Some, not all, of the order total collected — e.g. a deposit with the remainder still due.
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

// Where an order originated; orders are one unified collection regardless of channel.
const ORDER_CHANNEL = Object.freeze({
  STOREFRONT: "storefront",
  EBAY: "ebay",
  // In-person/counter sale created by staff from the admin dashboard.
  MANUAL: "manual",
});

// How a storefront order reaches the customer; pickup carries no shipping_address/cost.
const ORDER_DELIVERY_METHOD = Object.freeze({
  DELIVERY: "delivery",
  PICKUP: "pickup",
});

// Splits ORDER_STATUS's mixed payment/fulfilment concerns apart, since overwriting FULFILLED
// with REFUNDED was exactly the bug that motivated this. Distinct from payment.constants.js's
// PAYMENT_STATUS (a single Payment's lifecycle vs. an Order's aggregate position) — do not conflate.
const ORDER_PAYMENT_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

// Admin-editable order lifecycle, deliberately independent of ORDER_PAYMENT_STATUS.
const ORDER_FULFILLMENT_STATUS = Object.freeze({
  PENDING: "pending",
  PROCESSING: "processing",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

module.exports = {
  ORDER_STATUS,
  ORDER_CHANNEL,
  ORDER_DELIVERY_METHOD,
  ORDER_PAYMENT_STATUS,
  ORDER_FULFILLMENT_STATUS,
};
