// services/notification.service.js
// Owns Notification access; order alerts go to the tenant's active admins.

const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");
const websocketService = require("./websocket.service");
const {
  NOTIFICATION_TYPE,
  NOTIFICATION_CATEGORY_TYPES,
  NOTIFICATION_EVENT,
  NEW_ORDER_EVENT_BY_CHANNEL,
} = require("../constants/notification.constants");

// $ne false, not true: users saved before preferences existed stay opted in.
function orderRecipients(tenantId, event) {
  return User.find({
    tenant_id: tenantId,
    role: { $in: [USER_ROLE.ADMIN, USER_ROLE.SUPERADMIN] },
    status: USER_STATUS.ACTIVE,
    [`notification_preferences.events.${event}`]: { $ne: false },
  }).select("_id");
}

const orderData = (order) => ({
  order_id: order._id,
  order_number: order.order_number,
  channel: order.channel,
  total: order.total,
  customer_name: order.customer?.company_name || order.customer?.name || null,
});

/** One insert for every recipient x notification, then a live push each. */
async function sendOrderNotifications(tenantId, event, notifications) {
  const recipients = await orderRecipients(tenantId, event);
  if (!recipients.length || !notifications.length) return;

  await Notification.insertMany(
    recipients.flatMap((r) => notifications.map((n) => ({ tenant_id: tenantId, user_id: r._id, ...n }))),
  );
  const userIds = recipients.map((r) => r._id.toString());
  notifications.forEach((n) => websocketService.emitToUsers(userIds, "notification:new", n));
}

async function notifyNewOrder(tenantId, order) {
  const data = orderData(order);
  const event = NEW_ORDER_EVENT_BY_CHANNEL[order.channel] ?? NOTIFICATION_EVENT.STOREFRONT_ORDERS;
  await sendOrderNotifications(tenantId, event, [
    {
      type: NOTIFICATION_TYPE.ORDER_NEW,
      title: "New order received",
      message: `Order ${order.order_number} was just placed${data.customer_name ? ` by ${data.customer_name}` : ""}.`,
      data,
    },
  ]);
}

/** Overdue account invoices for one tenant, one notification per invoice. */
async function notifyInvoicesOverdue(tenantId, orders) {
  await sendOrderNotifications(
    tenantId,
    NOTIFICATION_EVENT.OVERDUE_INVOICES,
    orders.map((order) => {
      const data = orderData(order);
      return {
        type: NOTIFICATION_TYPE.ORDER_OVERDUE,
        title: "Invoice overdue",
        message: `Order ${order.order_number}${data.customer_name ? ` for ${data.customer_name}` : ""} is past its due date.`,
        data,
      };
    }),
  );
}

/** Unread totals overall and per bell tab, from one grouped query. */
async function countUnreadByCategory(userId, tenantId) {
  const rows = await Notification.aggregate([
    // Aggregations skip Mongoose casting, so string ids must become ObjectIds.
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(String(userId)),
        tenant_id: new mongoose.Types.ObjectId(String(tenantId)),
        read_at: null,
      },
    },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);
  const byType = new Map(rows.map((r) => [r._id, r.count]));
  const byCategory = Object.fromEntries(
    Object.entries(NOTIFICATION_CATEGORY_TYPES).map(([category, types]) => [
      category,
      types.reduce((sum, type) => sum + (byType.get(type) ?? 0), 0),
    ]),
  );
  return { total: rows.reduce((sum, r) => sum + r.count, 0), byCategory };
}

/** One page of a user's feed, optionally one bell tab's types only. */
async function listNotifications(userId, tenantId, { page, limit, skip, category }) {
  const filter = { user_id: userId, tenant_id: tenantId };
  if (category) filter.type = { $in: NOTIFICATION_CATEGORY_TYPES[category] };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    countUnreadByCategory(userId, tenantId),
  ]);
  return {
    items,
    total,
    unread_count: unread.total,
    unread_by_category: unread.byCategory,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

async function markAsRead(notificationId, userId) {
  await Notification.updateOne(
    { _id: notificationId, user_id: userId, read_at: null },
    { read_at: new Date() },
  );
}

/** Marks the whole feed read, or one bell tab's types only. */
async function markAllAsRead(userId, tenantId, { category } = {}) {
  const filter = { user_id: userId, tenant_id: tenantId, read_at: null };
  if (category) filter.type = { $in: NOTIFICATION_CATEGORY_TYPES[category] };
  await Notification.updateMany(filter, { read_at: new Date() });
}

// Hydrated, not lean, so schema defaults fill users saved before prefs existed.
async function getNotificationPreferences(userId) {
  const user = await User.findById(userId).select("notification_preferences");
  return user ? user.toObject().notification_preferences : null;
}

/** Partial update: only the events and flags sent are changed. */
async function updateNotificationPreferences(userId, { events = {}, show_toasts }) {
  const set = Object.fromEntries(
    Object.entries(events).map(([key, on]) => [`notification_preferences.events.${key}`, on]),
  );
  if (show_toasts !== undefined) set["notification_preferences.show_toasts"] = show_toasts;
  const user = await User.findByIdAndUpdate(userId, { $set: set }, { new: true, runValidators: true }).select(
    "notification_preferences",
  );
  return user ? user.toObject().notification_preferences : null;
}

module.exports = {
  notifyNewOrder,
  notifyInvoicesOverdue,
  listNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
};
