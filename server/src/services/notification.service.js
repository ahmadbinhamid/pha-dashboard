// services/notification.service.js
// Owns Notification access; order alerts go to the tenant's active admins.

const Notification = require("../models/Notification");
const User = require("../models/User");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");
const websocketService = require("./websocket.service");
const { NOTIFICATION_TYPE } = require("../constants/notification.constants");

function orderRecipients(tenantId) {
  return User.find({
    tenant_id: tenantId,
    role: { $in: [USER_ROLE.ADMIN, USER_ROLE.SUPERADMIN] },
    status: USER_STATUS.ACTIVE,
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
async function sendOrderNotifications(tenantId, notifications) {
  const recipients = await orderRecipients(tenantId);
  if (!recipients.length || !notifications.length) return;

  await Notification.insertMany(
    recipients.flatMap((r) => notifications.map((n) => ({ tenant_id: tenantId, user_id: r._id, ...n }))),
  );
  const userIds = recipients.map((r) => r._id.toString());
  notifications.forEach((n) => websocketService.emitToUsers(userIds, "notification:new", n));
}

async function notifyNewOrder(tenantId, order) {
  const data = orderData(order);
  await sendOrderNotifications(tenantId, [
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

async function listNotifications(userId, tenantId, { page, limit, skip }) {
  const filter = { user_id: userId, tenant_id: tenantId };
  const [items, total, unread_count] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read_at: null }),
  ]);
  return { items, total, unread_count, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
}

async function markAsRead(notificationId, userId) {
  await Notification.updateOne(
    { _id: notificationId, user_id: userId, read_at: null },
    { read_at: new Date() },
  );
}

async function markAllAsRead(userId, tenantId) {
  await Notification.updateMany(
    { user_id: userId, tenant_id: tenantId, read_at: null },
    { read_at: new Date() },
  );
}

module.exports = { notifyNewOrder, notifyInvoicesOverdue, listNotifications, markAsRead, markAllAsRead };
