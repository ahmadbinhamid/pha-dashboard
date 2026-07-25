// services/dashboard.service.js

const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const MarketplaceListing = require("../models/MarketplaceListing");
const InventorySettings = require("../models/InventorySettings");
const { ORDER_STATUS } = require("../constants/order.constants");
const { LISTING_STATE, MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

// Orders still awaiting settlement — what the dashboard means by "pending".
const PENDING_ORDER_STATUSES = [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIALLY_PAID];

// ── Stat cards ───────────────────────────────────────────────────────────────

// Sum of stock_count * product.price (dollars — Product.price is stored in
// dollars, unlike Order/Payment which are cents) across every inventory
// record for a non-deleted product.
async function getInventoryValue() {
  const [result] = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null } },
    { $group: { _id: null, totalValue: { $sum: { $multiply: ["$stock_count", "$product.price"] } } } },
  ]);
  return result?.totalValue || 0;
}

// Rolls locations up to one row per product+variant first — "low on stock"
// is a property of the item overall, not of any single shelf.
async function getStockCounts(lowStockThreshold) {
  const [result] = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null } },
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

async function getPendingOrdersStats() {
  const pendingOrders = await Order.find({ status: { $in: PENDING_ORDER_STATUSES } })
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

// Only Storefront and eBay are real channels in this system today — no
// Amazon/Walmart/Shopify integration exists, so this never fabricates rows
// for platforms that aren't actually connected. eBay's health is measured
// by what fraction of its active listings are currently in sync.
async function getChannelHealth() {
  const listings = await MarketplaceListing.find({
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
  })
    .select("sync_status synced_at")
    .lean();

  const total = listings.length;
  const syncedCount = listings.filter((l) => l.sync_status === "synced").length;
  const erroredCount = listings.filter((l) => l.sync_status === "error").length;
  const lastSyncedAt = listings.reduce(
    (latest, l) => (l.synced_at && (!latest || l.synced_at > latest) ? l.synced_at : latest),
    null,
  );

  const channels = [
    {
      key: "storefront",
      name: "Storefront",
      status: "operational",
      lastSyncedAt: null,
      detail: "Always available — no external sync",
    },
    {
      key: "ebay",
      name: "eBay",
      status: total === 0 ? "not_connected" : erroredCount > 0 ? "attention" : "operational",
      lastSyncedAt,
      listingsSynced: syncedCount,
      listingsTotal: total,
    },
  ];

  const operationalCount = channels.filter((c) => c.status === "operational").length;
  const stabilityPct = total === 0 ? 100 : Math.round((syncedCount / total) * 100);

  return { channels, operationalCount, totalChannels: channels.length, stabilityPct };
}

async function getStats() {
  const settings = await InventorySettings.getOrCreate();
  const [totalInventoryValue, stockCounts, pendingOrders, channelHealth] = await Promise.all([
    getInventoryValue(),
    getStockCounts(settings.low_stock_threshold),
    getPendingOrdersStats(),
    getChannelHealth(),
  ]);

  return {
    totalInventoryValue,
    lowStockCount: stockCounts.lowStockCount,
    outOfStockCount: stockCounts.outOfStockCount,
    pendingOrdersCount: pendingOrders.count,
    pendingOrdersAvgAgeHours: pendingOrders.avgAgeHours,
    syncStabilityPct: channelHealth.stabilityPct,
    channelsOperational: channelHealth.operationalCount,
    channelsTotal: channelHealth.totalChannels,
  };
}

// ── Order volume trend ───────────────────────────────────────────────────────

// One bucket per calendar day for the last `days` days (including today),
// always returning a fully-populated series (zero-filled) so the chart never
// has to guess about missing days.
async function getOrderVolumeTrend(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const orders = await Order.find({
    created_at: { $gte: since },
    status: { $ne: ORDER_STATUS.CANCELLED },
  })
    .select("created_at total items")
    .lean();

  const byDate = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate.set(key, { date: key, orders: 0, revenueCents: 0, items: 0 });
  }

  for (const order of orders) {
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (!bucket) continue; // order.created_at rounding edge case — ignore rather than crash
    bucket.orders += 1;
    bucket.revenueCents += order.total;
    bucket.items += order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  return Array.from(byDate.values());
}

// ── Recent activity — synthesized from Orders + InventoryHistory ───────────
// No dedicated activity/audit log exists in this system; this merges the two
// event sources this app actually has, newest first.

async function getRecentActivity(limit = 10) {
  const [recentOrders, recentStockChanges] = await Promise.all([
    Order.find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .select("order_number channel status created_at customer")
      .lean(),
    InventoryHistory.find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .populate("product", "title")
      .populate("variant", "display_name")
      .lean(),
  ]);

  const events = [
    ...recentOrders.map((o) => ({
      id: `order_${o._id}`,
      type: "order",
      title: `New order — ${o.customer.name}`,
      description: `${o.order_number} via ${o.channel}`,
      timestamp: o.created_at,
      tags: [o.channel, o.status],
    })),
    ...recentStockChanges.map((h) => ({
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
      timestamp: h.created_at,
      tags: [h.type],
    })),
  ];

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, limit);
}

// ── Critical stock ───────────────────────────────────────────────────────────

// Rolled up to one row per product+variant (summed across locations) so this
// lines up with getStockCounts()'s definition of "low on stock" — a product
// split across two half-empty shelves shouldn't read as two separate alerts.
async function getCriticalStock(limit = 10) {
  const settings = await InventorySettings.getOrCreate();

  const rows = await Inventory.aggregate([
    { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.deleted_at": null } },
    { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
    { $addFields: { variant: { $arrayElemAt: ["$variant", 0] } } },
    {
      $group: {
        _id: { product: "$product._id", variant: "$variant._id" },
        stockCount: { $sum: "$stock_count" },
        // Every location record for the same product+variant carries identical
        // product/variant details — $first is just "pick one", not an aggregate.
        product: { $first: "$product" },
        variant: { $first: "$variant" },
        // A stand-in id for the Reorder action — any one of this item's
        // per-location Inventory records works, since adjustStock() only
        // needs *a* record for this product+variant to attribute the credit to.
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
  getCriticalStock,
};
