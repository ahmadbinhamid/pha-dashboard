// services/order-overdue.service.js
// Alerts staff once when a business account invoice passes its due date.

const Order = require("../models/Order");
const config = require("../config");
const notificationService = require("./notification.service");
const { overdueInvoices } = require("../utils/orderVisibility");
const { logger } = require("../loaders/logging");

const CHUNK_SIZE = 200;
const NOTIFY_FIELDS = "tenant_id order_number channel total customer.name customer.company_name";

function groupByTenant(orders) {
  const groups = new Map();
  for (const order of orders) {
    const key = String(order.tenant_id);
    if (!groups.has(key)) groups.set(key, { tenantId: order.tenant_id, orders: [] });
    groups.get(key).orders.push(order);
  }
  return [...groups.values()];
}

// Marked only after the alerts land, so a failed chunk retries next sweep.
async function notifyChunk(orders, now) {
  for (const { tenantId, orders: tenantOrders } of groupByTenant(orders)) {
    await notificationService.notifyInvoicesOverdue(tenantId, tenantOrders);
  }
  await Order.updateMany({ _id: { $in: orders.map((o) => o._id) } }, { $set: { overdue_notified_at: now } });
}

/** Cursor over newly overdue invoices, alerting in tenant-grouped chunks. */
async function sweepOverdueInvoices(now = new Date()) {
  if (!config.orders.overdueSweepEnabled) return { notified: 0, skipped: true };

  const cursor = Order.find({ ...overdueInvoices(now), overdue_notified_at: null })
    .select(NOTIFY_FIELDS)
    .lean()
    .cursor();

  let chunk = [];
  let notified = 0;
  for await (const order of cursor) {
    chunk.push(order);
    if (chunk.length < CHUNK_SIZE) continue;
    await notifyChunk(chunk, now);
    notified += chunk.length;
    chunk = [];
  }
  if (chunk.length) {
    await notifyChunk(chunk, now);
    notified += chunk.length;
  }

  logger.info(`[order-overdue] sweep complete: notified=${notified}`);
  return { notified, skipped: false };
}

module.exports = { sweepOverdueInvoices };
