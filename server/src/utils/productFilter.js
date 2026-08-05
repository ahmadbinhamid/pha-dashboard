// utils/productFilter.js

const mongoose = require("mongoose");
const { escapeRegex, buildWordSearchOr } = require("./regex");
const { PRODUCT_STATUS } = require("../constants/product.constants");

// Builds the Mongo match filter shared by product listing and category-count
// aggregation, so both stay in sync on what "matches the current search/filters"
// means. `authenticated: false` (public/storefront callers) always restricts to
// published+active products.
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
  if (query.make) {
    filter["vehicle.make"] = query.make.trim();
  }
  if (query.model) {
    filter["vehicle.model"] = query.model.trim();
  }
  if (query.model_code) {
    filter["vehicle.model_code"] = query.model_code.trim();
  }
  if (query.year !== undefined) {
    const year = query.year;
    and.push({ $or: [{ "vehicle.year_from": null }, { "vehicle.year_from": { $lte: year } }] });
    and.push({ $or: [{ "vehicle.year_to": null }, { "vehicle.year_to": { $gte: year } }] });
  }
  if (and.length) filter.$and = and;

  return filter;
}

module.exports = { buildProductFilter };
