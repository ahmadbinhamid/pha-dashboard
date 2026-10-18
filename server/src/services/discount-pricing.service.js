// services/discount-pricing.service.js
// Checkout pricing: picks the order's one discount and records its use.

const mongoose = require("mongoose");
const Discount = require("../models/Discount");
const DiscountRedemption = require("../models/DiscountRedemption");
const { buildCategoryExpander } = require("./category.service");
const { getProductCategories } = require("./product.service");
const { httpError } = require("../utils/http/httpError");
const { duplicateKeyField } = require("../utils/duplicateKey");
const { DISCOUNT_TYPE, DISCOUNT_SCOPE, DISCOUNT_STATUS } = require("../constants/discount.constants");
const { orderRangeLabel } = require("../utils/orderRange");

const normalizeCode = (code) => String(code).trim().toUpperCase();
const normalizeEmail = (email) => String(email).trim().toLowerCase();
const toCents = (dollars) => Math.round(Number(dollars || 0) * 100);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Derived status, order matters, e.g. a paused discount reads paused. */
function discountStatus(discount, now = new Date()) {
  if (!discount.active) return DISCOUNT_STATUS.PAUSED;
  if (discount.ends_at && new Date(discount.ends_at) <= now) return DISCOUNT_STATUS.ENDED;
  if (discount.usage_limit != null && discount.usage_count >= discount.usage_limit) return DISCOUNT_STATUS.EXHAUSTED;
  if (discount.starts_at && new Date(discount.starts_at) > now) return DISCOUNT_STATUS.SCHEDULED;
  return DISCOUNT_STATUS.LIVE;
}

const isDiscountLive = (discount, now) => discountStatus(discount, now) === DISCOUNT_STATUS.LIVE;

// Query form of discountStatus === LIVE, so Mongo filters instead of Node.
function liveFilter(tenantId, now = new Date()) {
  return {
    tenant_id: tenantId,
    active: true,
    $and: [
      { $or: [{ starts_at: null }, { starts_at: { $lte: now } }] },
      { $or: [{ ends_at: null }, { ends_at: { $gt: now } }] },
      { $or: [{ usage_limit: null }, { $expr: { $lt: ["$usage_count", "$usage_limit"] } }] },
    ],
  };
}

// Largest-remainder split so line discounts sum exactly to totalCents.
function allocateFixed(lineTotals, totalCents) {
  const total = sum(lineTotals);
  const capped = Math.min(totalCents, total);
  if (!total) return lineTotals.map(() => 0);
  const raw = lineTotals.map((t) => (t / total) * capped);
  const shares = raw.map(Math.floor);
  let leftover = capped - sum(shares);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (leftover <= 0) break;
    shares[i] += 1;
    leftover -= 1;
  }
  return shares;
}

const hasOrderRange = (d) => d.min_order_number != null || d.max_order_number != null;

/** Order-number check, priorOrders is null when the email is unknown. */
function orderAllows(discount, priorOrders) {
  if (!hasOrderRange(discount)) return true;
  if (priorOrders == null) return false;
  const orderNumber = priorOrders + 1;
  const { min_order_number: min, max_order_number: max } = discount;
  return (min == null || orderNumber >= min) && (max == null || orderNumber <= max);
}

function orderRangeMessage(discount, priorOrders) {
  if (priorOrders == null) return "Enter your email to use this code";
  return `This code is for a customer's ${orderRangeLabel(discount.min_order_number, discount.max_order_number)}`;
}

/** One discount against resolved lines (cents), null when it doesn't apply. */
function priceDiscount(discount, { items, shippingCents, isEligible }) {
  const subtotal = sum(items.map((i) => i.unit_price * i.quantity));
  if (subtotal < toCents(discount.minimum_order)) return null;
  const eligibleTotals = items.map((i) => (isEligible(discount, i) ? i.unit_price * i.quantity : 0));
  if (!eligibleTotals.some((t) => t > 0)) return null;

  if (discount.discount_type === DISCOUNT_TYPE.FREE_SHIPPING) {
    // NOTE: free shipping needs every line eligible, and something to waive.
    if (!shippingCents || !items.every((i) => isEligible(discount, i))) return null;
    return { lineDiscounts: items.map(() => 0), shippingCents: 0, amount: shippingCents };
  }
  const lineDiscounts =
    discount.discount_type === DISCOUNT_TYPE.PERCENT
      ? eligibleTotals.map((t) => Math.round((t * discount.discount_value) / 100))
      : allocateFixed(eligibleTotals, toCents(discount.discount_value));
  return { lineDiscounts, shippingCents, amount: sum(lineDiscounts) };
}

/** (discount, line) => eligible, with one category read for all discounts. */
async function buildEligibility(tenantId, discounts, items) {
  if (!discounts.some((d) => d.scope === DISCOUNT_SCOPE.CATEGORIES)) return () => true;
  const [expand, products] = await Promise.all([
    buildCategoryExpander(tenantId),
    getProductCategories(items.map((i) => i.product), tenantId),
  ]);
  const categoriesByProduct = new Map(products.map((p) => [String(p._id), (p.categories ?? []).map(String)]));
  const targets = new Map(discounts.map((d) => [String(d._id), expand(d.category_ids)]));
  return (discount, item) =>
    discount.scope !== DISCOUNT_SCOPE.CATEGORIES ||
    (categoriesByProduct.get(String(item.product)) ?? []).some((c) => targets.get(String(discount._id)).has(c));
}

// Every promo code is one use per email, automatic deals opt in.
const isOncePerCustomer = (discount) => !discount.is_automatic || discount.once_per_customer;

/** Ids of once-per-customer discounts this email has already used. */
async function redeemedDiscountIds(discounts, customerEmail) {
  const limited = discounts.filter(isOncePerCustomer).map((d) => d._id);
  if (!limited.length || !customerEmail) return new Set();
  const used = await DiscountRedemption.distinct("discount_id", {
    discount_id: { $in: limited },
    customer_key: normalizeEmail(customerEmail),
  });
  return new Set(used.map(String));
}

function withDiscount(discount, priced, items) {
  return {
    discount,
    items: items.map((i, idx) => ({ ...i, discount_amount: priced.lineDiscounts[idx] })),
    shipping_cost: priced.shippingCents,
    amount: priced.amount,
  };
}

function notApplicableMessage(discount) {
  const minimum = toCents(discount.minimum_order);
  return minimum
    ? `This code needs a cart subtotal of at least $${(minimum / 100).toFixed(2)}`
    : "This code doesn't apply to the items in your cart";
}

async function resolveCodeDiscount(tenantId, code, ctx) {
  const discount = await Discount.findOne({ ...liveFilter(tenantId), code: normalizeCode(code) }).lean();
  if (!discount) throw httpError("This promo code is not valid or has expired", 400);
  if (!orderAllows(discount, ctx.priorOrders)) throw httpError(orderRangeMessage(discount, ctx.priorOrders), 400);
  if ((await redeemedDiscountIds([discount], ctx.customerEmail)).size) {
    throw httpError("This code has already been used with this email", 400);
  }
  const isEligible = await buildEligibility(tenantId, [discount], ctx.items);
  const priced = priceDiscount(discount, { ...ctx, isEligible });
  if (!priced) throw httpError(notApplicableMessage(discount), 400);
  return withDiscount(discount, priced, ctx.items);
}

async function resolveAutomaticDiscount(tenantId, ctx) {
  const discounts = (await Discount.find({ ...liveFilter(tenantId), is_automatic: true }).lean()).filter((d) =>
    orderAllows(d, ctx.priorOrders),
  );
  if (!discounts.length) return null;
  const [isEligible, redeemed] = await Promise.all([
    buildEligibility(tenantId, discounts, ctx.items),
    redeemedDiscountIds(discounts, ctx.customerEmail),
  ]);
  let best = null;
  for (const discount of discounts) {
    if (redeemed.has(String(discount._id))) continue;
    const priced = priceDiscount(discount, { ...ctx, isEligible });
    if (priced && (!best || priced.amount > best.priced.amount)) best = { discount, priced };
  }
  return best ? withDiscount(best.discount, best.priced, ctx.items) : null;
}

/** The order's one discount: the code's (or a 400), else the best automatic. */
async function resolveCheckoutDiscount(tenantId, { code, items, shippingCents, customerEmail, priorOrders = null }) {
  const ctx = { items, shippingCents, customerEmail, priorOrders };
  const resolved = code ? await resolveCodeDiscount(tenantId, code, ctx) : await resolveAutomaticDiscount(tenantId, ctx);
  return resolved ?? { discount: null, items, shipping_cost: shippingCents, amount: 0 };
}

/** Claims one use atomically, throws if a usage or per-customer rule trips. */
async function reserveRedemption(discount, { tenantId, customerEmail, amount, orderTotal }) {
  const claimed = await Discount.findOneAndUpdate(
    { _id: discount._id, tenant_id: tenantId, $or: [{ usage_limit: null }, { $expr: { $lt: ["$usage_count", "$usage_limit"] } }] },
    { $inc: { usage_count: 1 } },
  );
  if (!claimed) throw httpError("This discount has just reached its usage limit", 409);
  const email = normalizeEmail(customerEmail);
  try {
    return await DiscountRedemption.create({
      tenant_id: tenantId,
      discount_id: discount._id,
      customer_email: email,
      customer_key: isOncePerCustomer(discount) ? email : new mongoose.Types.ObjectId().toString(),
      discount_amount: amount,
      order_total: orderTotal,
    });
  } catch (err) {
    await Discount.updateOne({ _id: discount._id, usage_count: { $gt: 0 } }, { $inc: { usage_count: -1 } });
    if (duplicateKeyField(err) === "discount_id") throw httpError("This code has already been used with this email", 400);
    throw err;
  }
}

async function attachRedemptionOrder(redemptionId, orderId) {
  await DiscountRedemption.updateOne({ _id: redemptionId }, { $set: { order_id: orderId } });
}

/** Undoes a reservation: the use goes back to the pool. */
async function releaseRedemption(redemption) {
  const { deletedCount } = await DiscountRedemption.deleteOne({ _id: redemption._id });
  if (deletedCount) {
    await Discount.updateOne({ _id: redemption.discount_id, usage_count: { $gt: 0 } }, { $inc: { usage_count: -1 } });
  }
}

/** Frees the use a cancelled order held, a no-op without one. */
async function releaseOrderRedemption(orderId, tenantId) {
  const redemption = await DiscountRedemption.findOne({ order_id: orderId, tenant_id: tenantId }).lean();
  if (redemption) await releaseRedemption(redemption);
}

module.exports = {
  discountStatus,
  isDiscountLive,
  orderAllows,
  priceDiscount,
  allocateFixed,
  resolveCheckoutDiscount,
  reserveRedemption,
  attachRedemptionOrder,
  releaseRedemption,
  releaseOrderRedemption,
  normalizeCode,
};
