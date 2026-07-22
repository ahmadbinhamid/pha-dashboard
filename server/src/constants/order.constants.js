// constants/order.constants.js

const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
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
});

// How a storefront order reaches the customer. Pickup orders carry no
// shipping_address and no shipping_cost — eBay orders are always DELIVERY.
const ORDER_DELIVERY_METHOD = Object.freeze({
  DELIVERY: "delivery",
  PICKUP: "pickup",
});

module.exports = { ORDER_STATUS, ORDER_CHANNEL, ORDER_DELIVERY_METHOD };
