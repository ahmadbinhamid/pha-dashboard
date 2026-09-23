// services/reports.service.js
// Backs the Reports & Analytics page, following dashboard.service.js's conventions: tenant-scoped,
// money in cents, dates bucketed by UTC calendar day. Gross-profit/turnover figures use nullable
// Product.cost_price, so they're an upper bound on profit whenever any product has no cost recorded.

const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { ORDER_STATUS, ORDER_CHANNEL } = require("../constants/order.constants");
const { getInventoryValue, getInventoryValueByCategory } = require("./dashboard.service");

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Same shape as dashboard.service.js#getOrderVolumeTrend's range resolution, kept as its own
// copy since it's a few lines of date arithmetic, not a DB query worth sharing.
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

// Fetches every non-cancelled order in the window plus the same-length prior window, in one
// query, plus a productId -> {costCents, categoryId} lookup. Every report reuses this same pair.
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

// Sums an order's items into { itemsSold, costCents }; a null cost_price contributes 0.
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

// ── Inventory turnover & stock velocity (over the requested range) ──────────
// Turnover = COGS / average inventory value, but this app has no historical inventory-value
// series — uses today's total value as a constant denominator against cumulative COGS instead,
// an approximation that trends the same direction as a real ratio without exact history.
async function getInventoryTurnover(tenantId, params = {}) {
  const range = resolveRange(params);
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

  // Real current stock value per category, so turnover reflects its own inventory rather than
  // a share of the tenant total (the old approach made every category's ratio move on any sale).
  // A category with no stock on record falls back to the tenant total to avoid dividing by zero.
  const valueByCategory = await getInventoryValueByCategory(tenantId);
  const categoryValueCents = new Map();
  for (const categoryId of categoryIds) {
    const dollars = valueByCategory.get(String(categoryId));
    if (dollars) categoryValueCents.set(categoryId, Math.round(dollars * 100));
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
