// services/ebay/ebay.listing.service.js
// CRUD operations for MarketplaceListing documents (eBay discriminator).

const mongoose = require("mongoose");
const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const vehicleModelService = require("../vehicle-model.service");
const { logger } = require("../../loaders/logging");
const { buildWordSearchOr } = require("../../utils/regex");

// Production eBay item URLs are marketplace-specific; sandbox uses one shared
// domain regardless of marketplace. Extend this map as new marketplaces are enabled.
const EBAY_SITE_DOMAINS = {
  EBAY_US: "ebay.com",
  EBAY_AU: "ebay.com.au",
  EBAY_GB: "ebay.co.uk",
  EBAY_CA: "ebay.ca",
  EBAY_DE: "ebay.de",
};

function buildEbayItemUrl(externalListingId, settings) {
  if (!externalListingId) return null;
  if (settings?.sandbox) return `https://sandbox.ebay.com/itm/${externalListingId}`;
  const domain = EBAY_SITE_DOMAINS[settings?.marketplace_id] || "ebay.com";
  return `https://www.${domain}/itm/${externalListingId}`;
}

// Best-effort: adds each fitment row's make/model/model_code/year combo to
// this tenant's OWN vehicle catalog (covers custom values typed into the
// fitment row Combobox) without letting a catalog write failure block the
// listing save. Never writes to the shared/global catalog — see
// vehicle-model.service.js.
async function syncFitmentCatalog(fitment, tenantId) {
  if (!Array.isArray(fitment) || fitment.length === 0) return;
  try {
    await vehicleModelService.upsertVehicleModelsFromRows(fitment, tenantId);
  } catch (err) {
    logger.warn(`[ebay.listing.service] failed to sync fitment catalog: ${err.message}`);
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

async function createListing(payload, tenantId) {
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

  const productDoc = await Product.findOne({ _id: product, tenant_id: tenantId }).select("_id");
  if (!productDoc) throw Object.assign(new Error("Product not found"), { status: 404 });

  const listing = await MarketplaceListing.create({
    tenant_id: tenantId,
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

  await syncFitmentCatalog(fitment, tenantId);

  return listing;
}

// ── Read ──────────────────────────────────────────────────────────────────────

async function getListingById(id, tenantId) {
  return MarketplaceListing.findOne({ _id: id, tenant_id: tenantId })
    .populate({
      path: "product",
      select: "title slug sku price brand mpn attachments vehicle",
      populate: { path: "attachments" },
    })
    .populate({
      path: "variant",
      select: "display_name sku price attachments",
      populate: { path: "attachments" },
    })
    .populate("photo_overrides");
}

// Aggregation (not .find()) because `search` must match against the
// populated product's title/sku, which Mongoose .populate() can't filter on
// — mirrors inventory.service.js's listInventory pattern.
async function listListings({ skip, limit, product, state, sync_status, search } = {}, tenantId, settings) {
  const match = { platform: MARKETPLACE_PLATFORM.EBAY, tenant_id: tenantId };
  if (product) match.product = mongoose.Types.ObjectId.createFromHexString(product);
  if (state) match.state = state;
  if (sync_status) match.sync_status = sync_status;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { title: 1, slug: 1, sku: 1, price: 1 } }],
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "productvariants",
        localField: "variant",
        foreignField: "_id",
        as: "variant",
        pipeline: [{ $project: { display_name: 1, sku: 1 } }],
      },
    },
    { $unwind: { path: "$variant", preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: buildWordSearchOr(
          ["product.title", "product.sku", "title_override", "store_sku", "item_specifics.mpn", "item_specifics.brand"],
          search,
        ),
      },
    });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  pipeline.push({ $sort: { created_at: -1 } }, { $skip: skip }, { $limit: limit });

  const [items, countResult] = await Promise.all([
    MarketplaceListing.aggregate(pipeline),
    MarketplaceListing.aggregate(countPipeline),
  ]);

  const shapedItems = items.map((item) => ({
    ...item,
    ebay_item_url: buildEbayItemUrl(item.external_listing_id, settings),
  }));

  return { items: shapedItems, total: countResult[0]?.total || 0 };
}

// ── Update ────────────────────────────────────────────────────────────────────

async function updateListing(id, payload, tenantId) {
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

  if (update.fitment) await syncFitmentCatalog(update.fitment, tenantId);

  return MarketplaceListing.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set: update }, { new: true, strict: false })
    .populate("product", "title slug sku price brand mpn attachments vehicle")
    .populate("variant", "display_name sku price attachments")
    .populate("photo_overrides");
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteListing(id, tenantId) {
  const filter = tenantId ? { _id: id, tenant_id: tenantId } : { _id: id };
  const listing = await MarketplaceListing.findOne(filter);
  if (!listing) return null;
  await listing.softDelete();
  return listing;
}

module.exports = {
  createListing,
  getListingById,
  listListings,
  updateListing,
  deleteListing,
  buildEbayItemUrl,
};
