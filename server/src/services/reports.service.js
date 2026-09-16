// services/reports.service.js
//
// Backs the Reports & Analytics page. Follows dashboard.service.js's
// conventions: every function is tenant-scoped, money moves in cents
// (except where it's read straight off Product.price/cost_price, which are
// dollars — converted to cents at the point of use, same as
// dashboard.service.js#getInventoryValue does with Product.price), and date
// ranges are bucketed by UTC calendar day so a chart never has to guess
// about a missing day.
//
// Gross-profit/turnover figures below use Product.cost_price, which is
// nullable — a product with no cost set contributes revenue but $0 cost to
// any gross-profit/COGS figure, so those figures are an UPPER bound on
// profit (and a lower bound on COGS/turnover), not exact, whenever any
// product in the range has no cost recorded.

const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { ORDER_STATUS, ORDER_CHANNEL } = require("../constants/order.constants");
const { getInventoryValue } = require("./dashboard.service");

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Same shape as dashboard.service.js#getOrderVolumeTrend's own range
// resolution (days vs explicit from/to, plus the matching previous-period
// window) — kept as its own small copy here rather than exported from that
// file, since it's a few lines of date arithmetic, not a DB query to reuse.
function resolveRange({ days = 30, from, to } = {}) {
  let sinceUtc, untilUtc;
  if (from && to) {
    sinceUtc = startOfUtcDay(new Date(from));
    untilUtc = startOfUtcDay(new Date(to));
  } else {
    untilUtc = startOfUtcDay(new Date());
    sinceUtc = new Date(Date.UTC(untilUtc.getUTCFullYear(), untilUtc.getUTCMonth(), untilUtc.getUTCDate() - (days - 1)));
  }
  const exclusiveUntilUtc = new Date(Date.UTC(untilUtc.getUTCFullYear(), untilUtc.getUTCMonth(), untilUtc.getUTCDate() + 1));
  const dayCount = Math.round((exclusiveUntilUtc - sinceUtc) / 86_400_000);
  const previousSinceUtc = new Date(Date.UTC(sinceUtc.getUTCFullYear(), sinceUtc.getUTCMonth(), sinceUtc.getUTCDate() - dayCount));
  return { sinceUtc, exclusiveUntilUtc, dayCount, previousSinceUtc };
}

function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// Fetches every non-cancelled order in [previousSinceUtc, exclusiveUntilUtc)
// — the requested window plus the same-length prior window, in one query —
// along with a productId -> {costCents, categoryId} lookup for every
// product referenced by an item in those orders. Every report below is
// derived from this same pair (orders, productInfo) rather than re-querying
// per metric.
async function fetchRangeOrdersWithProductInfo(tenantId, { exclusiveUntilUtc, previousSinceUtc }) {
  const orders = await Order.find({
    tenant_id: tenantId,
    status: { $ne: ORDER_STATUS.CANCELLED },
    created_at: { $gte: previousSinceUtc, $lt: exclusiveUntilUtc },
  })
    .select("created_at channel total items")
    .lean();

  const productIds = new Set();
  for (const order of orders) {
    for (const item of order.items) productIds.add(String(item.product));
  }

  const products = await Product.find({ _id: { $in: Array.from(productIds) } })
    .select("cost_price categories")
    .lean();

  const productInfo = new Map(
    products.map((p) => [
      String(p._id),
      {
        costCents: p.cost_price == null ? null : Math.round(p.cost_price * 100),
        categoryId: p.categories?.[0] ? String(p.categories[0]) : null,
      },
    ]),
  );

  return { orders, productInfo };
}

function isCurrentPeriod(order, sinceUtc) {
  return new Date(order.created_at) >= sinceUtc;
}

// Sums an order's items into { itemsSold, costCents } — costCents is null
// contribution skipped (see file-level cost_price caveat), unit costs summed
// per line quantity.
function summarizeItems(items, productInfo) {
  let itemsSold = 0;
  let costCents = 0;
  for (const item of items) {
    itemsSold += item.quantity;
    const info = productInfo.get(String(item.product));
    if (info?.costCents != null) costCents += info.costCents * item.quantity;
  }
  return { itemsSold, costCents };
}

// ── Summary (5 top metric cards) ────────────────────────────────────────────

async function getSummary(tenantId, params = {}) {
  const range = resolveRange(params);
  const { sinceUtc, exclusiveUntilUtc, dayCount } = range;
  const { orders, productInfo } = await fetchRangeOrdersWithProductInfo(tenantId, range);

  const byDate = new Map();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(Date.UTC(sinceUtc.getUTCFullYear(), sinceUtc.getUTCMonth(), sinceUtc.getUTCDate() + i));
    byDate.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), revenueCents: 0, orders: 0, itemsSold: 0, costCents: 0 });
  }

  const current = { revenueCents: 0, orders: 0, itemsSold: 0, costCents: 0 };
  const previous = { revenueCents: 0, orders: 0, itemsSold: 0, costCents: 0 };

  for (const order of orders) {
    const { itemsSold, costCents } = summarizeItems(order.items, productInfo);
    const bucket = isCurrentPeriod(order, sinceUtc) ? current : previous;
    bucket.revenueCents += order.total;
    bucket.orders += 1;
    bucket.itemsSold += itemsSold;
    bucket.costCents += costCents;

    if (isCurrentPeriod(order, sinceUtc)) {
      const key = new Date(order.created_at).toISOString().slice(0, 10);
      const dayBucket = byDate.get(key);
      if (dayBucket) {
        dayBucket.revenueCents += order.total;
        dayBucket.orders += 1;
        dayBucket.itemsSold += itemsSold;
        dayBucket.costCents += costCents;
      }
    }
  }

  const avgOrderValueCents = current.orders > 0 ? Math.round(current.revenueCents / current.orders) : 0;
  const prevAvgOrderValueCents = previous.orders > 0 ? Math.round(previous.revenueCents / previous.orders) : 0;
  const grossProfitCents = current.revenueCents - current.costCents;
  const prevGrossProfitCents = previous.revenueCents - previous.costCents;

  const points = Array.from(byDate.values());

  return {
    range: { from: sinceUtc.toISOString().slice(0, 10), to: new Date(exclusiveUntilUtc - 86_400_000).toISOString().slice(0, 10), days: dayCount },
    revenueCents: current.revenueCents,
    revenueChangePct: pctChange(current.revenueCents, previous.revenueCents),
    orders: current.orders,
    ordersChangePct: pctChange(current.orders, previous.orders),
    itemsSold: current.itemsSold,
    itemsSoldChangePct: pctChange(current.itemsSold, previous.itemsSold),
    avgOrderValueCents,
    avgOrderValueChangePct: pctChange(avgOrderValueCents, prevAvgOrderValueCents),
    grossProfitCents,
    grossProfitChangePct: pctChange(grossProfitCents, prevGrossProfitCents),
    dailyRevenueCents: points.map((p) => p.revenueCents),
    dailyOrders: points.map((p) => p.orders),
    dailyItemsSold: points.map((p) => p.itemsSold),
    dailyGrossProfitCents: points.map((p) => p.revenueCents - p.costCents),
  };
}

// ── Revenue by channel ──────────────────────────────────────────────────────

async function getRevenueByChannel(tenantId, params = {}) {
  const range = resolveRange(params);
  const { orders } = await fetchRangeOrdersWithProductInfo(tenantId, range);

  const totals = new Map(Object.values(ORDER_CHANNEL).map((c) => [c, 0]));
  let grandTotalCents = 0;
  for (const order of orders) {
    if (!isCurrentPeriod(order, range.sinceUtc)) continue;
    totals.set(order.channel, (totals.get(order.channel) || 0) + order.total);
    grandTotalCents += order.total;
  }

  return Array.from(totals.entries())
    .filter(([, cents]) => cents > 0)
    .map(([channel, revenueCents]) => ({
      channel,
      revenueCents,
      pct: grandTotalCents > 0 ? (revenueCents / grandTotalCents) * 100 : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

// ── Top categories by revenue ───────────────────────────────────────────────

async function getTopCategories(tenantId, params = {}, limit = 6) {
  const range = resolveRange(params);
  const { orders, productInfo } = await fetchRangeOrdersWithProductInfo(tenantId, range);

  const revenueByCategory = new Map();
  let grandTotalCents = 0;
  for (const order of orders) {
    if (!isCurrentPeriod(order, range.sinceUtc)) continue;
    for (const item of order.items) {
      const lineRevenueCents = item.unit_price * item.quantity - (item.discount_amount || 0);
      const categoryId = productInfo.get(String(item.product))?.categoryId || null;
      revenueByCategory.set(categoryId, (revenueByCategory.get(categoryId) || 0) + lineRevenueCents);
      grandTotalCents += lineRevenueCents;
    }
  }

  const categoryIds = Array.from(revenueByCategory.keys()).filter(Boolean);
  const categories = await Category.find({ _id: { $in: categoryIds } }).select("name").lean();
  const nameById = new Map(categories.map((c) => [String(c._id), c.name]));

  return Array.from(revenueByCategory.entries())
    .map(([categoryId, revenueCents]) => ({
      categoryId,
      name: categoryId ? nameById.get(categoryId) || "Uncategorized" : "Uncategorized",
      revenueCents,
      pct: grandTotalCents > 0 ? (revenueCents / grandTotalCents) * 100 : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);
}

// ── Sales performance by channel (table) ────────────────────────────────────

async function getSalesPerformanceByChannel(tenantId, params = {}) {
  const range = resolveRange(params);
  const { orders, productInfo } = await fetchRangeOrdersWithProductInfo(tenantId, range);

  const empty = () => ({ revenueCents: 0, orders: 0, itemsSold: 0, costCents: 0 });
  const current = new Map(Object.values(ORDER_CHANNEL).map((c) => [c, empty()]));
  const previous = new Map(Object.values(ORDER_CHANNEL).map((c) => [c, empty()]));

  for (const order of orders) {
    const { itemsSold, costCents } = summarizeItems(order.items, productInfo);
    const bucket = (isCurrentPeriod(order, range.sinceUtc) ? current : previous).get(order.channel);
    if (!bucket) continue; // unknown channel value — ignore rather than crash
    bucket.revenueCents += order.total;
    bucket.orders += 1;
    bucket.itemsSold += itemsSold;
    bucket.costCents += costCents;
  }

  return Array.from(current.entries())
    .filter(([, c]) => c.orders > 0)
    .map(([channel, c]) => {
      const prev = previous.get(channel);
      return {
        channel,
        revenueCents: c.revenueCents,
        orders: c.orders,
        itemsSold: c.itemsSold,
        avgOrderValueCents: c.orders > 0 ? Math.round(c.revenueCents / c.orders) : 0,
        grossProfitCents: c.revenueCents - c.costCents,
        trendPct: pctChange(c.revenueCents, prev.revenueCents),
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

// ── 30-day inventory turnover & stock velocity ──────────────────────────────
//
// Inventory turnover = COGS / average inventory value. This app keeps no
// historical inventory-*value* time series (only point-in-time value, plus
// per-adjustment InventoryHistory deltas) — so "average inventory value"
// over the window can't be reconstructed exactly. This uses today's total
// inventory value as a constant denominator against real, cumulative COGS
// (Product.cost_price x quantity sold) building up day by day, which is an
// approximation, not an exact historical ratio — it trends the same
// direction a real one would (more sold against a roughly-steady inventory
// base pushes the ratio up) without pretending to know what inventory value
// looked like on each past day.
async function getInventoryTurnover(tenantId, { days = 30 } = {}) {
  const range = resolveRange({ days });
  const { sinceUtc, dayCount } = range;
  const { orders, productInfo } = await fetchRangeOrdersWithProductInfo(tenantId, range);
  const inventoryValueCents = Math.round((await getInventoryValue(tenantId)) * 100);

  const categoryIds = new Set();
  for (const info of productInfo.values()) if (info.categoryId) categoryIds.add(info.categoryId);
  const categories = await Category.find({ _id: { $in: Array.from(categoryIds) } }).select("name").lean();
  const nameById = new Map(categories.map((c) => [String(c._id), c.name]));

  const byDate = new Map();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(Date.UTC(sinceUtc.getUTCFullYear(), sinceUtc.getUTCMonth(), sinceUtc.getUTCDate() + i));
    byDate.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), unitsMoved: 0, cogsCents: 0, cogsByCategoryCents: new Map() });
  }

  for (const order of orders) {
    if (!isCurrentPeriod(order, sinceUtc)) continue;
    const key = new Date(order.created_at).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (!bucket) continue;
    for (const item of order.items) {
      const info = productInfo.get(String(item.product));
      const itemCostCents = info?.costCents != null ? info.costCents * item.quantity : 0;
      bucket.unitsMoved += item.quantity;
      bucket.cogsCents += itemCostCents;
      if (info?.categoryId) {
        bucket.cogsByCategoryCents.set(
          info.categoryId,
          (bucket.cogsByCategoryCents.get(info.categoryId) || 0) + itemCostCents,
        );
      }
    }
  }

  // Category value denominators — current stock value per category, so
  // "Category Comparison" turnover isn't just cumulative COGS spread evenly
  // across categories with wildly different inventory levels. Falls back to
  // the tenant's total when a category has no distinct value on record
  // (avoids a divide-by-zero blowing that category's ratio up to Infinity).
  const categoryValueCents = new Map();
  for (const info of productInfo.values()) {
    if (!info.categoryId) continue;
    if (!categoryValueCents.has(info.categoryId)) categoryValueCents.set(info.categoryId, inventoryValueCents / Math.max(categoryIds.size, 1));
  }

  let cumulativeCogsCents = 0;
  const cumulativeCogsByCategoryCents = new Map();
  const points = Array.from(byDate.values()).map((bucket, i) => {
    cumulativeCogsCents += bucket.cogsCents;
    const elapsedDays = i + 1;
    const turnoverRate = inventoryValueCents > 0 ? cumulativeCogsCents / inventoryValueCents : 0;
    const daysOfInventory = turnoverRate > 0 ? elapsedDays / turnoverRate : elapsedDays;

    const categoryRates = {};
    for (const [categoryId, cogsCents] of bucket.cogsByCategoryCents.entries()) {
      cumulativeCogsByCategoryCents.set(categoryId, (cumulativeCogsByCategoryCents.get(categoryId) || 0) + cogsCents);
    }
    for (const categoryId of categoryIds) {
      const catValueCents = categoryValueCents.get(categoryId) || inventoryValueCents;
      const catCumulativeCogsCents = cumulativeCogsByCategoryCents.get(categoryId) || 0;
      categoryRates[nameById.get(categoryId) || "Uncategorized"] = catValueCents > 0 ? catCumulativeCogsCents / catValueCents : 0;
    }

    return {
      date: bucket.date,
      unitsMoved: bucket.unitsMoved,
      cogsCents: bucket.cogsCents,
      turnoverRate,
      daysOfInventory,
      categoryRates,
    };
  });

  const categoryRanking = Array.from(categoryIds)
    .map((categoryId) => {
      const catValueCents = categoryValueCents.get(categoryId) || inventoryValueCents;
      const catCumulativeCogsCents = cumulativeCogsByCategoryCents.get(categoryId) || 0;
      const rate = catValueCents > 0 ? catCumulativeCogsCents / catValueCents : 0;
      return {
        name: nameById.get(categoryId) || "Uncategorized",
        turnoverRate: rate,
        daysOfInventory: rate > 0 ? dayCount / rate : dayCount,
      };
    })
    .sort((a, b) => b.turnoverRate - a.turnoverRate);

  const avgTurnoverRate = points.length > 0 ? points[points.length - 1].turnoverRate : 0;
  const avgDaysOfInventory = points.length > 0 ? points[points.length - 1].daysOfInventory : dayCount;
  const totalUnitsMoved = points.reduce((sum, p) => sum + p.unitsMoved, 0);

  return {
    points,
    categoryRanking,
    summary: {
      avgTurnoverRate,
      avgDaysOfInventory,
      fastestCategory: categoryRanking[0] || null,
      totalUnitsMoved,
      inventoryValueCents,
    },
  };
}

module.exports = {
  getSummary,
  getRevenueByChannel,
  getTopCategories,
  getSalesPerformanceByChannel,
  getInventoryTurnover,
};
