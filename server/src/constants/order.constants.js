// constants/order.constants.js

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  // Some, but not all, of the order total has been collected — e.g. a
  // manual-sale deposit, with the remainder still due via cash/online
  // transfer/payment link. See utils/paymentStatus.js#derivePaymentStatus.
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

// Where an order originated. Orders are a single unified collection
// regardless of channel — this just tags where each one came from.
const ORDER_CHANNEL = Object.freeze({
  STOREFRONT: "storefront",
  EBAY: "ebay",
  // In-person/counter sale created by staff from the admin dashboard.
  MANUAL: "manual",
});

// How a storefront order reaches the customer. Pickup orders carry no
// shipping_address and no shipping_cost — eBay orders are always DELIVERY.
const ORDER_DELIVERY_METHOD = Object.freeze({
  DELIVERY: "delivery",
  PICKUP: "pickup",
});

// refund-redesign-spec.md §1.2 — splits ORDER_STATUS's two mixed concerns
// (payment state vs fulfilment state) apart, since finalizeSucceededRefund
// overwriting FULFILLED with REFUNDED was exactly the bug that motivated the
// split. Distinct name from payment.constants.js's PAYMENT_STATUS (that one
// describes a single Payment/Stripe-intent's own lifecycle; this one
// describes an Order's aggregate payment position across all its payments
// and refunds) — same word, deliberately different enum, do not conflate.
// Additive only for now: `status` (below) stays authoritative until the
// derived-field backfill (§6.2) and the services that read it are migrated
// (§9) — nothing writes or reads these two new fields yet.
const ORDER_PAYMENT_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PARTIALLY_PAID: "partially_paid",
  PAID: "paid",
  PARTIALLY_REFUNDED: "partially_refunded",
  REFUNDED: "refunded",
});

// Admin-editable order lifecycle — deliberately independent of
// ORDER_PAYMENT_STATUS (a Completed order isn't necessarily fully paid, and
// a Paid order isn't necessarily fulfilled yet). Matches flowpos's 5-state
// order status exactly.
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
