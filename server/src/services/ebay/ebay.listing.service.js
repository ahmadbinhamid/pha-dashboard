// services/ebay/ebay.listing.service.js
// eBay listing write preparation, plus eBay-shaped list/read/delete.

const mongoose = require("mongoose");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const vehicleModelService = require("../vehicle-model.service");
const { logger } = require("../../loaders/logging");
const { buildWordSearchOr } = require("../../utils/regex");
const { toPackage } = require("../../utils/packageDimensions");

// Prod item URLs are per-marketplace; sandbox shares one domain.
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

// Best-effort sync to the tenant's own vehicle catalog; never blocks the save.
async function syncFitmentCatalog(fitment, tenantId) {
  if (!Array.isArray(fitment) || fitment.length === 0) return;
  try {
    await vehicleModelService.upsertVehicleModelsFromRows(fitment, tenantId);
  } catch (err) {
    logger.warn(`[ebay.listing.service] failed to sync fitment catalog: ${err.message}`);
  }
}

// ── Write preparation; the writes go through listing.write.service ──

/** eBay discriminator fields for a new listing, with eBay's defaults. */
function buildCreateFields(payload) {
  const {
    title_override = null,
    description_override = null,
    price_override = null,
    photo_overrides = [],
    ebay_category_id = null,
    store_category_id = null,
    store_sku = null,
    condition = null,
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

  return {
    title_override,
    description_override,
    price_override: price_override != null ? Number(price_override) : null,
    photo_overrides,
    state: LISTING_STATE.DRAFT,
    ebay_category_id,
    store_category_id,
    store_sku,
    // NOTE: "" and null both mean "inherit from product"; stored as null.
    condition: condition || null,
    condition_notes,
    item_specifics: { ...item_specifics, authenticity: item_specifics.authenticity || null },
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
    package: toPackage(pkg),
  };
}

/** Runs once after a fresh create. */
async function afterCreate(listing, payload, tenantId) {
  await syncFitmentCatalog(payload.fitment ?? [], tenantId);
}

// ── Read ──

async function getListingById(id, tenantId) {
  return MarketplaceListing.findOne({ _id: id, tenant_id: tenantId })
    .populate({
      path: "product",
      select: "title slug sku price brand mpn condition attachments vehicle additional_fitments categories",
      populate: { path: "attachments" },
    })
    .populate({
      path: "variant",
      select: "display_name sku price attachments",
      populate: { path: "attachments" },
    })
    .populate("photo_overrides");
}

// Aggregation so `search` can match the populated product's title/sku.
async function listListings({ skip, limit, product, product_in, state, sync_status, search } = {}, tenantId, settings) {
  const match = { platform: MARKETPLACE_PLATFORM.EBAY, tenant_id: tenantId };
  if (product) match.product = mongoose.Types.ObjectId.createFromHexString(product);
  // Batch "which products have a listing" lookup; input is page-bounded.
  if (product_in?.length) {
    match.product = { $in: product_in.map((id) => mongoose.Types.ObjectId.createFromHexString(id)) };
  }
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
  pipeline.push({ $sort: { created_at: -1 } });
  // product_in already bounds results; paginating would truncate them.
  if (!product_in?.length) pipeline.push({ $skip: skip }, { $limit: limit });

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

// ── Update ──

const UPDATE_FIELDS = [
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

// Product fields the update response populates.
const UPDATE_PRODUCT_FIELDS = "title slug sku price brand mpn attachments vehicle additional_fitments";

/** $set for an update; syncs the fitment catalog first, as before. */
async function buildUpdate(payload, tenantId) {
  const update = {};
  for (const key of UPDATE_FIELDS) {
    if (payload[key] !== undefined) update[key] = payload[key];
  }

  if (update.condition !== undefined) update.condition = update.condition || null;

  if (update.price_override != null) update.price_override = Number(update.price_override);
  if (update.quantity_available != null) update.quantity_available = Number(update.quantity_available);
  if (update.min_best_offer != null) update.min_best_offer = Number(update.min_best_offer);
  if (update.package) update.package = toPackage(update.package);

  // Dot-notation keys skip Mongoose's whole-subdoc cast path.
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
  return update;
}

// ── Delete ──

async function deleteListing(id, tenantId) {
  const filter = tenantId ? { _id: id, tenant_id: tenantId } : { _id: id };
  const listing = await MarketplaceListing.findOne(filter);
  if (!listing) return null;
  await listing.softDelete();
  return listing;
}

module.exports = {
  buildCreateFields,
  afterCreate,
  buildUpdate,
  UPDATE_PRODUCT_FIELDS,
  PUSH_ON_CREATE: false,
  getListingById,
  listListings,
  deleteListing,
  buildEbayItemUrl,
};
