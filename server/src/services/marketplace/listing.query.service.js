// services/marketplace/listing.query.service.js
// Platform-agnostic listing browse/read/delete/push (create is per-platform).

const mongoose = require("mongoose");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { endListing } = require("./sync.service");
const { enqueueChannelJob } = require("../../queues/channel.queue");
const { buildWordSearchOr } = require("../../utils/regex");
const ebaySettingsService = require("../ebay/ebay.settings.service");
const { buildEbayItemUrl } = require("../ebay/ebay.listing.service");
const { MARKETPLACE_PLATFORM, LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");

// Same needs_attention definition as channel.service#listChannelsForTenant.
const NEEDS_ATTENTION_STATUSES = [LISTING_SYNC_STATUS.ERROR, LISTING_SYNC_STATUS.PRICE_LOCKED];

// Cross-platform listListings; omit `platform` to mix every platform's rows.
async function listListings(
  { skip, limit, product, product_in, platform, state, sync_status, needs_attention, search } = {},
  tenantId,
) {
  const match = { tenant_id: tenantId };
  if (platform) match.platform = platform;
  if (product) match.product = mongoose.Types.ObjectId.createFromHexString(product);
  // Products page Channels batch: no skip/limit, ids are already one page.
  if (product_in?.length) {
    match.product = { $in: product_in.map((id) => mongoose.Types.ObjectId.createFromHexString(id)) };
  }
  if (state) match.state = state;
  // needs_attention takes precedence over a plain sync_status.
  if (needs_attention) match.sync_status = { $in: NEEDS_ATTENTION_STATUSES };
  else if (sync_status) match.sync_status = sync_status;

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
  if (!product_in?.length) pipeline.push({ $skip: skip }, { $limit: limit });

  const [items, countResult] = await Promise.all([
    MarketplaceListing.aggregate(pipeline),
    MarketplaceListing.aggregate(countPipeline),
  ]);

  // eBay item URLs for eBay rows only; settings fetched only if one is present.
  const hasEbayRows = items.some((item) => item.platform === MARKETPLACE_PLATFORM.EBAY);
  const ebaySettings = hasEbayRows ? await ebaySettingsService.getSettings(tenantId) : null;
  const shapedItems = items.map((item) =>
    item.platform === MARKETPLACE_PLATFORM.EBAY
      ? { ...item, ebay_item_url: buildEbayItemUrl(item.external_listing_id, ebaySettings) }
      : item,
  );

  return { items: shapedItems, total: countResult[0]?.total || 0 };
}

// Shared by both passes below so their $group stages stay identical.
const GROUPED_LISTING_PROJECTION = {
  _id: "$_id",
  platform: "$platform",
  state: "$state",
  sync_status: "$sync_status",
  synced_at: "$synced_at",
  sync_error: "$sync_error",
  external_listing_id: "$external_listing_id",
  condition: "$condition",
  store_sku: "$store_sku",
  updated_at: "$updated_at",
};

// One row per product; filters pick products, never hide a product's channels.
async function listListingsGroupedByProduct(
  { skip, limit, product, product_in, platform, state, sync_status, needs_attention, search } = {},
  tenantId,
) {
  const match = { tenant_id: tenantId };
  if (platform) match.platform = platform;
  if (product) match.product = mongoose.Types.ObjectId.createFromHexString(product);
  if (product_in?.length) {
    match.product = { $in: product_in.map((id) => mongoose.Types.ObjectId.createFromHexString(id)) };
  }
  if (state) match.state = state;
  // See listListings' identical NOTE — needs_attention takes precedence.
  if (needs_attention) match.sync_status = { $in: NEEDS_ATTENTION_STATUSES };
  else if (sync_status) match.sync_status = sync_status;

  // Pass 1: which products qualify (filtered), paginated
  const findPipeline = [
    { $match: match },
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "product",
        pipeline: [{ $project: { _id: 1 } }],
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    findPipeline.push({
      $match: {
        $or: buildWordSearchOr(
          ["product.title", "product.sku", "title_override", "store_sku", "item_specifics.mpn", "item_specifics.brand"],
          search,
        ),
      },
    });
  }

  findPipeline.push(
    { $group: { _id: "$product._id", latest_updated_at: { $max: "$updated_at" } } },
    { $sort: { latest_updated_at: -1 } },
  );

  const countPipeline = [...findPipeline, { $count: "total" }];
  findPipeline.push({ $skip: skip }, { $limit: limit });

  const [idRows, countResult] = await Promise.all([
    MarketplaceListing.aggregate(findPipeline),
    MarketplaceListing.aggregate(countPipeline),
  ]);
  const total = countResult[0]?.total || 0;

  const pageProductIds = idRows.map((r) => r._id).filter(Boolean);
  if (!pageProductIds.length) return { items: [], total };

  // Pass 2: the full, unfiltered listing set for those products
  const fullPipeline = [
    { $match: { tenant_id: tenantId, product: { $in: pageProductIds } } },
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
      $group: {
        _id: "$product._id",
        product: { $first: "$product" },
        listings: { $push: GROUPED_LISTING_PROJECTION },
      },
    },
  ];

  const groups = await MarketplaceListing.aggregate(fullPipeline);

  // Pass 2 doesn't promise Pass 1's relevance order — re-order explicitly.
  const groupsById = new Map(groups.map((g) => [String(g._id), g]));
  const orderedGroups = pageProductIds.map((id) => groupsById.get(String(id))).filter(Boolean);

  // eBay item URL enrichment, same as listListings above.
  const hasEbayRows = orderedGroups.some((g) => g.listings.some((l) => l.platform === MARKETPLACE_PLATFORM.EBAY));
  const ebaySettings = hasEbayRows ? await ebaySettingsService.getSettings(tenantId) : null;

  const items = orderedGroups.map((g) => ({
    product: g.product,
    listings: g.listings.map((l) =>
      l.platform === MARKETPLACE_PLATFORM.EBAY
        ? { ...l, ebay_item_url: buildEbayItemUrl(l.external_listing_id, ebaySettings) }
        : l,
    ),
  }));

  return { items, total };
}

async function getListingById(id, tenantId) {
  return MarketplaceListing.findOne({ _id: id, tenant_id: tenantId })
    .populate({
      path: "product",
      select: "title slug sku price brand mpn condition attachments vehicle stock_control",
      populate: { path: "attachments" },
    })
    .populate({
      path: "variant",
      select: "display_name sku price attachments",
      populate: { path: "attachments" },
    })
    .populate("photo_overrides");
}

// Mirrors ebay.listing.controller.js#deleteListing, generalized via endListing.
async function deleteListing(id, tenantId, { logger } = {}) {
  const listing = await MarketplaceListing.findOne({ _id: id, tenant_id: tenantId });
  if (!listing) return null;

  if (listing.external_listing_id || listing.external_offer_id) {
    const result = await endListing(listing._id);
    if (result?.error && logger) {
      logger.warn(`[listing.query.service] ${listing.platform} withdrawal failed for ${listing._id}: ${result.error}`);
    }
  }

  await listing.softDelete();
  return listing;
}

// Re-enqueues sync_listing; seq: null as a manual push has no fencing token.
async function pushListing(id, tenantId) {
  const listing = await MarketplaceListing.findOne({ _id: id, tenant_id: tenantId }).select("platform");
  if (!listing) return null;
  await enqueueChannelJob(listing.platform, "sync_listing", { listingId: listing._id.toString(), seq: null });
  return listing;
}

module.exports = { listListings, listListingsGroupedByProduct, getListingById, deleteListing, pushListing };
