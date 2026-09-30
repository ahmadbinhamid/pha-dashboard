// services/dashboard.service.js
// Tenant-scoped; Inventory/History scope via a $lookup on product.tenant_id.

const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const MarketplaceListing = require("../models/MarketplaceListing");
const InventorySettings = require("../models/InventorySettings");
const Tenant = require("../models/Tenant");
const { ORDER_STATUS, ORDER_CHANNEL } = require("../constants/order.constants");
const mongoose = require("mongoose");
const {
  LISTING_STATE,
  LISTING_SUCCESS_STATUSES,
  LISTING_NEEDS_ATTENTION_STATUSES,
} = require("../constants/marketplace.constants");
const { buildWordSearchOr } = require("../utils/regex");
const { formatOrderNumber, stripOrderNumberPrefix } = require("../utils/orderNumberFormat");

// Orders still awaiting settlement — what the dashboard means by "pending".
const PENDING_ORDER_STATUSES = [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID];

// Stat cards

// Stock value in dollars (Product.price is dollars) for non-deleted products.
async function getInventoryValue(tenantId) {
  const [result] = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
    { $group: { _id: null, totalValue: { $sum: { $multiply: ["$stock_count", "$product.price"] } } } },
  ]);
  return result?.totalValue || 0;
}

// Past this, a near-zero baseline makes the % noise; return null instead.
const MAX_MEANINGFUL_CHANGE_PCT = 500;

/** Stock value (dollars) by first category id; uncategorised under "". */
async function getInventoryValueByCategory(tenantId) {
  const rows = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ["$product.categories", 0] }, null] },
        totalValue: { $sum: { $multiply: ["$stock_count", "$product.price"] } },
      },
    },
  ]);

  return new Map(rows.map((r) => [r._id ? String(r._id) : "", r.totalValue || 0]));
}

async function getInventoryValueChangePct(tenantId, currentValue, days = 7) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [result] = await InventoryHistory.aggregate([
    { $match: { created_at: { $gte: since } } },
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
    { $group: { _id: null, netValueChange: { $sum: { $multiply: ["$adjustment", "$product.price"] } } } },
  ]);

  const netValueChange = result?.netValueChange || 0;
  const baselineValue = currentValue - netValueChange;
  if (baselineValue <= 0) return null;

  const changePct = (netValueChange / baselineValue) * 100;
  if (Math.abs(changePct) > MAX_MEANINGFUL_CHANGE_PCT) return null;
  return changePct;
}

// One row per product+variant: low stock is per item, not per shelf.
async function getStockCounts(tenantId, lowStockThreshold) {
  const [result] = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
    { $group: { _id: { product: "$product._id", variant: "$variant" }, totalStock: { $sum: "$stock_count" } } },
    {
      $group: {
        _id: null,
        lowStockCount: {
          $sum: {
            $cond: [{ $and: [{ $gt: ["$totalStock", 0] }, { $lte: ["$totalStock", lowStockThreshold] }] }, 1, 0],
          },
        },
        outOfStockCount: { $sum: { $cond: [{ $eq: ["$totalStock", 0] }, 1, 0] } },
      },
    },
  ]);
  return { lowStockCount: result?.lowStockCount || 0, outOfStockCount: result?.outOfStockCount || 0 };
}

async function getPendingOrdersStats(tenantId) {
  const pendingOrders = await Order.find({ tenant_id: tenantId, status: { $in: PENDING_ORDER_STATUSES } })
    .select("created_at")
    .lean();

  if (pendingOrders.length === 0) return { count: 0, avgAgeHours: 0 };

  const now = Date.now();
  const totalAgeMs = pendingOrders.reduce((sum, o) => sum + (now - new Date(o.created_at).getTime()), 0);

  return {
    count: pendingOrders.length,
    avgAgeHours: totalAgeMs / pendingOrders.length / (1000 * 60 * 60),
  };
}

// Per-adapter health from one grouped query over the tenant's active listings.
async function getPlatformChannelHealth(tenantId, adapter) {
  const rows = await MarketplaceListing.aggregate([
    {
      $match: {
        tenant_id: new mongoose.Types.ObjectId(String(tenantId)),
        platform: adapter.key,
        state: LISTING_STATE.ACTIVE,
      },
    },
    { $group: { _id: "$sync_status", count: { $sum: 1 }, lastSyncedAt: { $max: "$synced_at" } } },
  ]);

  const countOf = (statuses) => rows.filter((r) => statuses.includes(r._id)).reduce((sum, r) => sum + r.count, 0);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const failed = countOf(LISTING_NEEDS_ATTENTION_STATUSES);
  const lastSyncedAt = rows.reduce(
    (latest, r) => (r.lastSyncedAt && (!latest || r.lastSyncedAt > latest) ? r.lastSyncedAt : latest),
    null,
  );

  return {
    key: adapter.key,
    name: adapter.manifest?.name || adapter.key,
    status: total === 0 ? "not_connected" : failed > 0 ? "attention" : "operational",
    lastSyncedAt,
    listingsSynced: countOf(LISTING_SUCCESS_STATUSES),
    listingsFailed: failed,
    listingsTotal: total,
  };
}

// NOTE: floor, so any failure shows under 100%; null when nothing has settled.
function syncStabilityPct(succeeded, failed) {
  const settled = succeeded + failed;
  return settled === 0 ? null : Math.floor((succeeded / settled) * 100);
}

// Storefront is hardcoded (no sync); every adapter comes from the registry.
async function getChannelHealth(tenantId) {
  const registry = require("./marketplace/registry");
  const platformChannels = await Promise.all(
    registry.getAll().map((adapter) => getPlatformChannelHealth(tenantId, adapter)),
  );

  const channels = [
    {
      key: "storefront",
      name: "Storefront",
      status: "operational",
      lastSyncedAt: null,
      detail: "Always available — no external sync",
    },
    ...platformChannels,
  ];

  const operationalCount = channels.filter((c) => c.status === "operational").length;
  const totalSucceeded = platformChannels.reduce((sum, c) => sum + c.listingsSynced, 0);
  const totalFailed = platformChannels.reduce((sum, c) => sum + c.listingsFailed, 0);
  const stabilityPct = syncStabilityPct(totalSucceeded, totalFailed);

  return { channels, operationalCount, totalChannels: channels.length, stabilityPct };
}

async function getStats(tenantId) {
  const settings = await InventorySettings.getOrCreate(tenantId);
  // The change % needs this total as its baseline, so it can't join the batch.
  const totalInventoryValue = await getInventoryValue(tenantId);
  const [inventoryValueChangePct, stockCounts, pendingOrders, channelHealth] = await Promise.all([
    getInventoryValueChangePct(tenantId, totalInventoryValue),
    getStockCounts(tenantId, settings.low_stock_threshold),
    getPendingOrdersStats(tenantId),
    getChannelHealth(tenantId),
  ]);

  return {
    totalInventoryValue,
    inventoryValueChangePct,
    lowStockCount: stockCounts.lowStockCount,
    outOfStockCount: stockCounts.outOfStockCount,
    pendingOrdersCount: pendingOrders.count,
    pendingOrdersAvgAgeHours: pendingOrders.avgAgeHours,
    syncStabilityPct: channelHealth.stabilityPct,
    channelsOperational: channelHealth.operationalCount,
    channelsTotal: channelHealth.totalChannels,
  };
}

// Dashboard trend (order volume + revenue, by channel)

// UTC boundaries: local midnights shifted every bucket a day on UTC+ hosts.
function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function getOrderVolumeTrend(tenantId, { days = 7, from, to } = {}) {
  let sinceUtc, untilUtc;
  if (from && to) {
    sinceUtc = startOfUtcDay(new Date(from));
    untilUtc = startOfUtcDay(new Date(to));
  } else {
    untilUtc = startOfUtcDay(new Date());
    sinceUtc = new Date(Date.UTC(untilUtc.getUTCFullYear(), untilUtc.getUTCMonth(), untilUtc.getUTCDate() - (days - 1)));
  }
  // "to" is a whole day, so the bound is the start of the next day.
  const exclusiveUntilUtc = new Date(Date.UTC(untilUtc.getUTCFullYear(), untilUtc.getUTCMonth(), untilUtc.getUTCDate() + 1));
  const dayCount = Math.round((exclusiveUntilUtc - sinceUtc) / 86_400_000);
  const previousSinceUtc = new Date(Date.UTC(sinceUtc.getUTCFullYear(), sinceUtc.getUTCMonth(), sinceUtc.getUTCDate() - dayCount));

  const orders = await Order.find({
    tenant_id: tenantId,
    created_at: { $gte: previousSinceUtc, $lt: exclusiveUntilUtc },
    status: { $ne: ORDER_STATUS.CANCELLED },
  })
    .select("created_at total items channel")
    .lean();

  const channelKeys = Object.values(ORDER_CHANNEL);
  const byDate = new Map();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(Date.UTC(sinceUtc.getUTCFullYear(), sinceUtc.getUTCMonth(), sinceUtc.getUTCDate() + i));
    const key = d.toISOString().slice(0, 10);
    const byChannel = {};
    for (const channel of channelKeys) byChannel[channel] = 0;
    byDate.set(key, { date: key, orders: 0, revenueCents: 0, items: 0, byChannel });
  }

  let previousPeriodRevenueCents = 0;
  for (const order of orders) {
    const createdAt = new Date(order.created_at);
    if (createdAt < sinceUtc) {
      previousPeriodRevenueCents += order.total;
      continue;
    }
    const key = createdAt.toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (!bucket) continue; // order.created_at rounding edge case — ignore rather than crash
    bucket.orders += 1;
    bucket.revenueCents += order.total;
    bucket.items += order.items.reduce((sum, i) => sum + i.quantity, 0);
    bucket.byChannel[order.channel] = (bucket.byChannel[order.channel] || 0) + order.total;
  }

  return { points: Array.from(byDate.values()), previousPeriodRevenueCents };
}

// Recent activity: no audit log exists, so merge Orders + InventoryHistory.

// Same "A$1,234.56" format as invoicePdf.js#formatMoney.
function formatOrderTotal(cents) {
  return `A$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mapOrderEvent(o) {
  return {
    id: `order_${o._id}`,
    type: "order",
    title: `New Order ${formatOrderNumber(o.order_number_prefix, o.order_number)}`,
    // Channel goes in tags[0] so the UI renders it as its own badge.
    description: formatOrderTotal(o.total),
    timestamp: o.created_at,
    tags: [o.channel, o.status],
  };
}

function mapStockEvent(h) {
  return {
    id: `stock_${h._id}`,
    type: "stock",
    title: h.adjustment >= 0 ? "Inventory Restock" : "Stock Adjustment",
    description: [
      h.product ? h.product.title : "Product",
      h.variant ? `(${h.variant.display_name})` : null,
      `${h.adjustment >= 0 ? "+" : ""}${h.adjustment} units`,
      h.reason || null,
    ]
      .filter(Boolean)
      .join(" "),
    // Variant SKU wins: it's the one that maps to eBay's inventory item.
    sku: h.variant?.sku || h.product?.sku || null,
    timestamp: h.created_at,
    tags: [h.type],
  };
}

// No tenant_id on InventoryHistory, so scope via a $lookup on Product.
async function findRecentStockEvents(tenantId, limit) {
  return InventoryHistory.aggregate([
    { $sort: { created_at: -1 } },
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.tenant_id": tenantId } },
    { $limit: limit },
    { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
    { $addFields: { variant: { $arrayElemAt: ["$variant", 0] } } },
  ]);
}

async function getRecentActivity(tenantId, limit = 10) {
  const [recentOrders, recentStockChanges] = await Promise.all([
    Order.find({ tenant_id: tenantId })
      .sort({ created_at: -1 })
      .limit(limit)
      .select("order_number order_number_prefix channel status total created_at customer")
      .lean(),
    findRecentStockEvents(tenantId, limit),
  ]);

  const events = [...recentOrders.map(mapOrderEvent), ...recentStockChanges.map(mapStockEvent)];

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, limit);
}

// Each source fetches its top skip+limit, then merge; never the whole table.
async function listActivity(tenantId, { page = 1, limit = 20, type = "", from, to, search } = {}) {
  const skip = (page - 1) * limit;
  const fetchCount = skip + limit;

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const includeOrders = type !== "stock";
  const includeStock = type !== "order";

  const orderFilter = { tenant_id: tenantId };
  if (hasDateFilter) orderFilter.created_at = dateFilter;
  let strippedSearch = search;
  if (search) {
    const tenant = await Tenant.findById(tenantId).select("order_number_prefix invoice_number_prefix").lean();
    strippedSearch = stripOrderNumberPrefix(search, [tenant?.order_number_prefix, tenant?.invoice_number_prefix]);
    // buildWordSearchOr escapes input, closing a regex-injection/ReDoS hole.
    orderFilter.$or = buildWordSearchOr(["order_number", "customer.name", "customer.email"], strippedSearch);
  }

  // Tenant match must precede $sort/$limit or other tenants fill the slice.
  const stockBasePipeline = [];
  if (hasDateFilter) stockBasePipeline.push({ $match: { created_at: dateFilter } });
  stockBasePipeline.push(
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.tenant_id": tenantId } },
    { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
    { $addFields: { variant: { $arrayElemAt: ["$variant", 0] } } },
  );
  if (search) {
    stockBasePipeline.push({
      // SKUs are searchable too; staff often only know the SKU from eBay.
      $match: { $or: buildWordSearchOr(["product.title", "product.sku", "variant.sku", "reason"], search) },
    });
  }

  const [orderDocs, orderTotal, stockDocs, stockTotal] = await Promise.all([
    includeOrders
      ? Order.find(orderFilter)
          .sort({ created_at: -1 })
          .limit(fetchCount)
          .select("order_number order_number_prefix channel status total created_at customer")
          .lean()
      : [],
    includeOrders ? Order.countDocuments(orderFilter) : 0,
    includeStock ? InventoryHistory.aggregate([...stockBasePipeline, { $sort: { created_at: -1 } }, { $limit: fetchCount }]) : [],
    includeStock
      ? InventoryHistory.aggregate([...stockBasePipeline, { $count: "total" }]).then((r) => r[0]?.total || 0)
      : 0,
  ]);

  const events = [...orderDocs.map(mapOrderEvent), ...stockDocs.map(mapStockEvent)];
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const total = orderTotal + stockTotal;
  return {
    items: events.slice(skip, skip + limit),
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Zero-filled day buckets (default: last 14 days), like getOrderVolumeTrend.
async function getActivityAnalytics(tenantId, { from, to } = {}) {
  const rangeTo = to ? new Date(to) : new Date();
  const rangeFrom = from
    ? new Date(from)
    : (() => {
        const d = new Date(rangeTo);
        d.setDate(d.getDate() - 13);
        return d;
      })();

  const dateFilter = { $gte: rangeFrom, $lte: rangeTo };

  const [orders, stockChanges] = await Promise.all([
    Order.find({ tenant_id: tenantId, created_at: dateFilter }).select("created_at").lean(),
    InventoryHistory.aggregate([
      { $match: { created_at: dateFilter } },
      { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $match: { "product.tenant_id": tenantId } },
      { $project: { created_at: 1 } },
    ]),
  ]);

  const byDate = new Map();
  const cursor = new Date(rangeFrom);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(rangeTo);
  endDay.setHours(0, 0, 0, 0);
  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    byDate.set(key, { date: key, orders: 0, stock: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const o of orders) {
    const bucket = byDate.get(new Date(o.created_at).toISOString().slice(0, 10));
    if (bucket) bucket.orders += 1;
  }
  for (const h of stockChanges) {
    const bucket = byDate.get(new Date(h.created_at).toISOString().slice(0, 10));
    if (bucket) bucket.stock += 1;
  }

  return {
    totalEvents: orders.length + stockChanges.length,
    orderEvents: orders.length,
    stockEvents: stockChanges.length,
    dailyTrend: Array.from(byDate.values()),
  };
}

// Critical stock

// Summed across locations, matching getStockCounts' low-stock definition.
async function getCriticalStock(tenantId, limit = 10) {
  const settings = await InventorySettings.getOrCreate(tenantId);

  const rows = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null, "product.tenant_id": tenantId } },
    { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
    { $addFields: { variant: { $arrayElemAt: ["$variant", 0] } } },
    {
      $group: {
        _id: { product: "$product._id", variant: "$variant._id" },
        stockCount: { $sum: "$stock_count" },
        // Every location row shares the product details; $first just picks one.
        product: { $first: "$product" },
        variant: { $first: "$variant" },
        // Any location record works: adjustStock only needs one for this item.
        sampleInventoryId: { $first: "$_id" },
      },
    },
    { $match: { stockCount: { $lte: settings.low_stock_threshold } } },
    { $sort: { stockCount: 1 } },
    { $limit: limit },
  ]);

  return rows.map((r) => ({
    inventoryId: r.sampleInventoryId,
    productId: r.product._id,
    sku: r.variant?.sku || r.product.sku || "—",
    name: r.variant ? `${r.product.title} — ${r.variant.display_name}` : r.product.title,
    category: r.product.brand || null,
    stockCount: r.stockCount,
  }));
}

module.exports = {
  getStats,
  getChannelHealth,
  getOrderVolumeTrend,
  getRecentActivity,
  listActivity,
  getActivityAnalytics,
  getCriticalStock,
  // Shared with reports.service.js (inventory insights, turnover denominator).
  getInventoryValue,
  getInventoryValueByCategory,
};
