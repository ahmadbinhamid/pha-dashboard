// services/discount.service.js
// Discount CRUD, usage stats and the storefront's featured-discount summary.

const mongoose = require("mongoose");
const Discount = require("../models/Discount");
const DiscountRedemption = require("../models/DiscountRedemption");
// Registers the model that getDiscountUsage populates, whatever loaded first.
require("../models/Order");
const { findUnknownCategoryIds, expandCategoryIds } = require("./category.service");
const { discountStatus, normalizeCode } = require("./discount-pricing.service");
const { httpError } = require("../utils/http/httpError");
const {
  DISCOUNT_TYPE,
  DISCOUNT_SCOPE,
  MAX_PERCENT_OFF,
  RECENT_REDEMPTIONS_LIMIT,
} = require("../constants/discount.constants");

const EDITABLE_FIELDS = [
  "name",
  "code",
  "is_automatic",
  "discount_type",
  "discount_value",
  "minimum_order",
  "scope",
  "category_ids",
  "starts_at",
  "ends_at",
  "usage_limit",
  "once_per_customer",
  "min_order_number",
  "max_order_number",
  "active",
];

const ORDER_SUMMARY_FIELDS = "order_number order_number_prefix status total customer created_at";

const withStatus = (discount) => ({ ...discount, status: discountStatus(discount) });

/** Derived fields that must follow from others, e.g. automatic => no code. */
function normalize(fields) {
  const next = { ...fields };
  if (next.is_automatic) next.code = null;
  else if (next.code) next.code = normalizeCode(next.code);
  if (next.discount_type === DISCOUNT_TYPE.FREE_SHIPPING) next.discount_value = 0;
  // Promo codes are always one use per email.
  if (!next.is_automatic) next.once_per_customer = true;
  if (next.scope === DISCOUNT_SCOPE.STOREWIDE) next.category_ids = [];
  return next;
}

function assertRules(d) {
  if (!d.is_automatic && !d.code) throw httpError("Add a promo code or make the discount automatic", 422);
  if (d.discount_type !== DISCOUNT_TYPE.FREE_SHIPPING && !(d.discount_value > 0)) {
    throw httpError("Enter a discount amount", 422);
  }
  if (d.discount_type === DISCOUNT_TYPE.PERCENT && d.discount_value > MAX_PERCENT_OFF) {
    throw httpError(`A percentage discount can be at most ${MAX_PERCENT_OFF}%`, 422);
  }
  if (d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at)) {
    throw httpError("The end date must be after the start date", 422);
  }
  if (d.min_order_number && d.max_order_number && d.max_order_number < d.min_order_number) {
    throw httpError("The last qualifying order can't be before the first", 422);
  }
  if (d.scope === DISCOUNT_SCOPE.CATEGORIES && !d.category_ids?.length) {
    throw httpError("Pick at least one category", 422);
  }
}

async function assertValid(tenantId, d, excludeId = null) {
  assertRules(d);
  const [unknown, codeTaken] = await Promise.all([
    findUnknownCategoryIds(d.category_ids, tenantId),
    d.code ? Discount.exists({ tenant_id: tenantId, code: d.code, ...(excludeId && { _id: { $ne: excludeId } }) }) : null,
  ]);
  if (unknown.length) throw httpError("Unknown category", 422);
  if (codeTaken) throw httpError(`Another discount already uses code ${d.code}`, 409);
}

async function findDiscount(id, tenantId) {
  const discount = await Discount.findOne({ _id: id, tenant_id: tenantId }).lean();
  if (!discount) throw httpError("Discount not found", 404);
  return discount;
}

async function listDiscounts(tenantId) {
  const discounts = await Discount.find({ tenant_id: tenantId }).sort({ created_at: -1 }).lean();
  return discounts.map(withStatus);
}

/** Totals plus the latest redemptions, each with its order summary. */
async function getDiscountUsage(discountId, tenantId) {
  const match = {
    tenant_id: new mongoose.Types.ObjectId(String(tenantId)),
    discount_id: new mongoose.Types.ObjectId(String(discountId)),
  };
  const [[totals], recent] = await Promise.all([
    DiscountRedemption.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orders_count: { $sum: 1 },
          discount_total: { $sum: "$discount_amount" },
          order_total: { $sum: "$order_total" },
        },
      },
    ]),
    DiscountRedemption.find(match)
      .sort({ created_at: -1 })
      .limit(RECENT_REDEMPTIONS_LIMIT)
      .populate("order_id", ORDER_SUMMARY_FIELDS)
      .lean(),
  ]);
  return {
    orders_count: totals?.orders_count ?? 0,
    discount_total: totals?.discount_total ?? 0,
    order_total: totals?.order_total ?? 0,
    recent: recent.map(({ order_id: order, ...r }) => ({ ...r, order })),
  };
}

async function getDiscount(id, tenantId) {
  const discount = await findDiscount(id, tenantId);
  return { ...withStatus(discount), usage: await getDiscountUsage(discount._id, tenantId) };
}

async function createDiscount(tenantId, input) {
  const fields = normalize(input);
  await assertValid(tenantId, fields);
  const created = await Discount.create({ ...fields, tenant_id: tenantId });
  return withStatus(created.toObject());
}

async function updateDiscount(id, tenantId, patch) {
  const current = await findDiscount(id, tenantId);
  const next = normalize({ ...current, ...patch });
  await assertValid(tenantId, next, current._id);
  const $set = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, next[f]]));
  const updated = await Discount.findOneAndUpdate({ _id: current._id, tenant_id: tenantId }, { $set }, { new: true, runValidators: true }).lean();
  return withStatus(updated);
}

// Soft delete keeps redemptions and order history pointing at a real record.
async function deleteDiscount(id, tenantId) {
  const discount = await Discount.findOne({ _id: id, tenant_id: tenantId });
  if (!discount) throw httpError("Discount not found", 404);
  await discount.softDelete();
  return { _id: discount._id };
}

/** Quick-launch presets: refresh the discount with this code, or create it. */
async function upsertDiscountByCode(tenantId, input) {
  const existing = await Discount.findOne({ tenant_id: tenantId, code: normalizeCode(input.code) }).select("_id").lean();
  return existing ? updateDiscount(existing._id, tenantId, input) : createDiscount(tenantId, input);
}

/** What the storefront needs to advertise a discount, null if deleted. */
async function getDiscountSummary(discountId, tenantId) {
  if (!discountId) return null;
  const discount = await Discount.findOne({ _id: discountId, tenant_id: tenantId }).lean();
  if (!discount) return null;
  const eligible =
    discount.scope === DISCOUNT_SCOPE.CATEGORIES ? [...(await expandCategoryIds(discount.category_ids, tenantId))] : [];
  return { ...withStatus(discount), eligible_category_ids: eligible };
}

module.exports = {
  listDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  upsertDiscountByCode,
  getDiscountSummary,
};
