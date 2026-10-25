// constants/notification.constants.js
// Notification types, bell tabs and per-user opt-out events.

const { ORDER_CHANNEL } = require("./order.constants");

// Notification.type values; the dashboard bell reads them.
const NOTIFICATION_TYPE = Object.freeze({
  ORDER_NEW: "order.new",
  ORDER_OVERDUE: "order.overdue",
});

// Bell tabs, each a group of types, so old rows need no category field.
const NOTIFICATION_CATEGORY_TYPES = Object.freeze({
  orders: Object.freeze([NOTIFICATION_TYPE.ORDER_NEW]),
  invoices: Object.freeze([NOTIFICATION_TYPE.ORDER_OVERDUE]),
});

// Keys of User.notification_preferences.events; a missing key means on.
const NOTIFICATION_EVENT = Object.freeze({
  STOREFRONT_ORDERS: "storefront_orders",
  EBAY_ORDERS: "ebay_orders",
  IN_STORE_ORDERS: "in_store_orders",
  OVERDUE_INVOICES: "overdue_invoices",
});

const NEW_ORDER_EVENT_BY_CHANNEL = Object.freeze({
  [ORDER_CHANNEL.STOREFRONT]: NOTIFICATION_EVENT.STOREFRONT_ORDERS,
  [ORDER_CHANNEL.EBAY]: NOTIFICATION_EVENT.EBAY_ORDERS,
  [ORDER_CHANNEL.MANUAL]: NOTIFICATION_EVENT.IN_STORE_ORDERS,
});

module.exports = { NOTIFICATION_TYPE, NOTIFICATION_CATEGORY_TYPES, NOTIFICATION_EVENT, NEW_ORDER_EVENT_BY_CHANNEL };
