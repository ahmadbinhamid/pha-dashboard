// services/ebay/ebay.listing.service.js
// CRUD operations for MarketplaceListing documents (eBay discriminator).

const MarketplaceListing = require("../../models/MarketplaceListing");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");

// ── Create ────────────────────────────────────────────────────────────────────

async function createListing(payload) {
  const {
    product,
    variant = null,
    title_override = null,
    description_override = null,
    price_override = null,
    photo_overrides = [],
    // eBay-specific
    ebay_category_id = null,
    store_category_id = null,
    store_sku = null,
    condition = "NEW",
    condition_notes = "",
    item_specifics = {},
    fitment = [],
    format = "FIXED_PRICE",
    quantity_available = null,
    listing_duration = "GTC",
    accept_best_offer = false,
    min_best_offer = null,
    fulfillment_policy_id = null,
    payment_policy_id = null,
    return_policy_id = null,
    require_immediate_payment = true,
    item_location_zip = null,
    package: pkg = {},
  } = payload;

  const listing = await MarketplaceListing.create({
    platform: MARKETPLACE_PLATFORM.EBAY,
    product,
    variant,
    title_override,
    description_override,
    price_override: price_override != null ? Number(price_override) : null,
    photo_overrides,
    state: LISTING_STATE.DRAFT,
    // eBay discriminator fields
    ebay_category_id,
    store_category_id,
    store_sku,
    condition,
    condition_notes,
    item_specifics,
    fitment,
    format,
    quantity_available: quantity_available != null ? Number(quantity_available) : null,
    listing_duration,
    accept_best_offer,
    min_best_offer: min_best_offer != null ? Number(min_best_offer) : null,
    fulfillment_policy_id,
    payment_policy_id,
    return_policy_id,
    require_immediate_payment,
    item_location_zip,
    package: {
      length: pkg.length != null ? Number(pkg.length) : null,
      width: pkg.width != null ? Number(pkg.width) : null,
      height: pkg.height != null ? Number(pkg.height) : null,
      weight: pkg.weight != null ? Number(pkg.weight) : null,
    },
  });

  return listing;
}

// ── Read ──────────────────────────────────────────────────────────────────────

async function getListingById(id) {
  return MarketplaceListing.findById(id)
    .populate("product", "title slug sku price brand attachments vehicle_make vehicle_model vehicle_model_code vehicle_year vehicle_year_to")
    .populate("variant", "display_name sku price attachments")
    .populate("photo_overrides");
}

async function getListingsByProduct(productId) {
  return MarketplaceListing.find({
    product: productId,
    platform: MARKETPLACE_PLATFORM.EBAY,
  })
    .populate("variant", "display_name sku")
    .sort({ created_at: -1 });
}

async function listListings({ skip, limit, product, state, sync_status } = {}) {
  const filter = { platform: MARKETPLACE_PLATFORM.EBAY };
  if (product) filter.product = product;
  if (state) filter.state = state;
  if (sync_status) filter.sync_status = sync_status;

  const [items, total] = await Promise.all([
    MarketplaceListing.find(filter)
      .populate("product", "title slug sku price")
      .populate("variant", "display_name sku")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit),
    MarketplaceListing.countDocuments(filter),
  ]);

  return { items, total };
}

// ── Update ────────────────────────────────────────────────────────────────────

async function updateListing(id, payload) {
  const allowed = [
    "title_override", "description_override", "price_override", "photo_overrides",
    "ebay_category_id", "store_category_id", "store_sku",
    "condition", "condition_notes", "item_specifics",
    "fitment",
    "format", "quantity_available", "listing_duration",
    "accept_best_offer", "min_best_offer",
    "fulfillment_policy_id", "payment_policy_id", "return_policy_id",
    "require_immediate_payment", "item_location_zip", "package",
    "state",
  ];

  const update = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) update[key] = payload[key];
  }

  // Coerce numeric strings
  if (update.price_override != null) update.price_override = Number(update.price_override);
  if (update.quantity_available != null) update.quantity_available = Number(update.quantity_available);
  if (update.min_best_offer != null) update.min_best_offer = Number(update.min_best_offer);
  if (update.package) {
    const p = update.package;
    update.package = {
      length: p.length != null ? Number(p.length) : null,
      width: p.width != null ? Number(p.width) : null,
      height: p.height != null ? Number(p.height) : null,
      weight: p.weight != null ? Number(p.weight) : null,
    };
  }

  // Expand item_specifics into dot-notation keys so Mongoose doesn't
  // try to cast the whole subdoc through the old in-memory schema path
  if (update.item_specifics) {
    const specs = update.item_specifics;
    update["item_specifics.brand"] = specs.brand ?? null;
    update["item_specifics.mpn"] = specs.mpn ?? null;
    update["item_specifics.superseded_part_number"] = Array.isArray(specs.superseded_part_number)
      ? specs.superseded_part_number
      : [];
    update["item_specifics.authenticity"] = specs.authenticity || null;
    update["item_specifics.warranty"] = specs.warranty || null;
    delete update.item_specifics;
  }

  return MarketplaceListing.findByIdAndUpdate(id, { $set: update }, { new: true, strict: false })
    .populate("product", "title slug sku price brand attachments vehicle_make vehicle_model vehicle_model_code vehicle_year vehicle_year_to")
    .populate("variant", "display_name sku price attachments")
    .populate("photo_overrides");
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteListing(id) {
  const listing = await MarketplaceListing.findById(id);
  if (!listing) return null;
  await listing.softDelete();
  return listing;
}

module.exports = {
  createListing,
  getListingById,
  getListingsByProduct,
  listListings,
  updateListing,
  deleteListing,
};
