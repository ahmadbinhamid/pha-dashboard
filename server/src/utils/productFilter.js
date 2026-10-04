// utils/productFilter.js

const mongoose = require("mongoose");
const { escapeRegex, buildWordSearchOr } = require("./regex");
const { PRODUCT_STATUS } = require("../constants/product.constants");

// Conditions one fitment must meet; `prefix` addresses a subdocument path.
function fitmentConditions(query, prefix = "") {
  const conditions = ["make", "model", "model_code"]
    .filter((key) => query[key])
    .map((key) => ({ [`${prefix}${key}`]: query[key].trim() }));
  if (query.year !== undefined) {
    conditions.push({ $or: [{ [`${prefix}year_from`]: null }, { [`${prefix}year_from`]: { $lte: query.year } }] });
    conditions.push({ $or: [{ [`${prefix}year_to`]: null }, { [`${prefix}year_to`]: { $gte: query.year } }] });
  }
  return conditions;
}

// Product list and category-count filter; public sees published+active only.
function buildProductFilter(query = {}, { authenticated = false, tenantId = null } = {}) {
  const filter = {};
  const and = [];

  if (tenantId) filter.tenant_id = tenantId;

  if (query.search) {
    and.push({
      $or: buildWordSearchOr(["title", "sku", "brand", "tags", "mpn", "description"], query.search),
    });
  }

  if (!authenticated) {
    filter.is_published_online = true;
    filter.status = PRODUCT_STATUS.ACTIVE;
  } else if (query.status !== undefined && query.status !== "") {
    filter.status = query.status;
  }

  if (query.type !== undefined && query.type !== "") {
    filter.type = query.type;
  }
  if (query.condition) {
    filter.condition = query.condition;
  }
  if (query.authenticity) {
    filter.authenticity = query.authenticity;
  }
  if (query.mpn) {
    filter.mpn = new RegExp(escapeRegex(query.mpn.trim()), "i");
  }
  if (query.sku) {
    filter.sku = new RegExp(escapeRegex(query.sku.trim()), "i");
  }
  // Comma-separated ids, e.g. a storefront cart refreshing its lines.
  if (query.ids) {
    const ids = query.ids.split(",").map((id) => id.trim()).filter((id) => mongoose.Types.ObjectId.isValid(id));
    filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (query.categories) {
    const cats = Array.isArray(query.categories)
      ? query.categories
      : query.categories.split(",");
    const filtered = cats
      .map((c) => c.trim())
      .filter((c) => mongoose.Types.ObjectId.isValid(c))
      .map((c) => new mongoose.Types.ObjectId(c));
    if (filtered.length) filter.categories = { $in: filtered };
  }
  if (query.price_min !== undefined || query.price_max !== undefined) {
    filter.price = {};
    if (query.price_min !== undefined) filter.price.$gte = query.price_min;
    if (query.price_max !== undefined) filter.price.$lte = query.price_max;
  }
  // A product fits when its default vehicle or any additional fitment matches.
  const fitment = fitmentConditions(query);
  if (fitment.length) {
    and.push({
      $or: [{ $and: fitmentConditions(query, "vehicle.") }, { additional_fitments: { $elemMatch: { $and: fitment } } }],
    });
  }
  if (and.length) filter.$and = and;

  return filter;
}

module.exports = { buildProductFilter };
