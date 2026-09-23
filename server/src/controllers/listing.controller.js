// controllers/listing.controller.js
// Thin HTTP layer over listing.query.service.js, the platform-agnostic browse/read/delete/push
// counterpart to each platform's own listing controller (which stay platform-specific for CREATE).

const { logger } = require("../loaders/logging");
const listingQueryService = require("../services/marketplace/listing.query.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

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

    // ?group_by=product returns one row per product with all listings nested, instead of per listing.
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
