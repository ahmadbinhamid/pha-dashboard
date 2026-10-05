// controllers/listing.controller.js
// Platform-agnostic listing HTTP layer; platform comes from validateListing.

const { logger } = require("../loaders/logging");
const listingQueryService = require("../services/marketplace/listing.query.service");
const listingWriteService = require("../services/marketplace/listing.write.service");
const registry = require("../services/marketplace/registry");
const { success, created, notFound, badRequest, systemfailure } = require("../utils/http/response");

// Same text the per-platform routes sent, so their responses stay identical.
function createdMessage(platform, pushesOnCreate) {
  return pushesOnCreate ? `Listing created and queued for ${registry.get(platform).manifest.name} sync` : "Listing created";
}

exports.createListing = async (req, res) => {
  try {
    const { listing, pushesOnCreate } = await listingWriteService.createListing(req.listingPlatform, req.body, req.tenantId);
    return created(res, listing, createdMessage(req.listingPlatform, pushesOnCreate));
  } catch (err) {
    if (err.code === 11000) return badRequest(res, "A listing for this product/variant/platform already exists");
    return systemfailure(res, err);
  }
};

exports.updateListing = async (req, res) => {
  try {
    const listing = await listingWriteService.updateListing(req.listingPlatform, req.params.id, req.body, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, listing, "Listing updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getListings = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const { product, product_in, platform, state, sync_status, needs_attention, search, group_by } = req.query;

    const args = [
      {
        skip,
        limit,
        product,
        product_in: product_in ? product_in.split(",").filter(Boolean) : undefined,
        platform,
        state,
        sync_status,
        needs_attention,
        search,
      },
      req.tenantId,
    ];

    // ?group_by=product: one row per product with its listings nested.
    const { items, total } =
      group_by === "product"
        ? await listingQueryService.listListingsGroupedByProduct(...args)
        : await listingQueryService.listListings(...args);

    return success(res, {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getListing = async (req, res) => {
  try {
    const listing = await listingQueryService.getListingById(req.params.id, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, listing);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const listing = await listingQueryService.deleteListing(req.params.id, req.tenantId, { logger });
    if (!listing) return notFound(res, "Listing not found");
    return success(res, null, "Listing deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.pushListing = async (req, res) => {
  try {
    const listing = await listingQueryService.pushListing(req.params.id, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, { queued: true }, `Listing queued for ${listing.platform} sync`);
  } catch (err) {
    return systemfailure(res, err);
  }
};
