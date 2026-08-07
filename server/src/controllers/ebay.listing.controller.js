// controllers/ebay.listing.controller.js

const listingService = require("../services/ebay/ebay.listing.service");
const settingsService = require("../services/ebay/ebay.settings.service");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { endListing } = require("../services/marketplace/sync.service");
const { logger } = require("../loaders/logging");
const {
  success,
  created,
  notFound,
  badRequest,
  systemfailure,
  validationError,
} = require("../utils/http/response");
const { validateListingForPush } = require("../validators/ebay.listing.validation");

exports.createListing = async (req, res) => {
  try {
    const { product } = req.body;
    if (!product) return badRequest(res, "product is required");

    const listing = await listingService.createListing(req.body, req.tenantId);
    return created(res, listing, "Listing created");
  } catch (err) {
    if (err.code === 11000) {
      return badRequest(res, "A listing for this product/variant/platform already exists");
    }
    return systemfailure(res, err);
  }
};

exports.getListing = async (req, res) => {
  try {
    const listing = await listingService.getListingById(req.params.id, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");

    const settings = await settingsService.getSettings(req.tenantId);
    const obj = listing.toObject();
    obj.ebay_item_url = listingService.buildEbayItemUrl(obj.external_listing_id, settings);

    return success(res, obj);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getListings = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const { product, product_in, state, sync_status, search } = req.query;
    const settings = await settingsService.getSettings(req.tenantId);

    const { items, total } = await listingService.listListings(
      {
        skip,
        limit,
        product,
        product_in: product_in ? product_in.split(",").filter(Boolean) : undefined,
        state,
        sync_status,
        search,
      },
      req.tenantId,
      settings,
    );

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

exports.updateListing = async (req, res) => {
  try {
    const listing = await listingService.updateListing(req.params.id, req.body, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, listing, "Listing updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const listing = await listingService.getListingById(req.params.id, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");

    if (listing.external_listing_id || listing.external_offer_id) {
      const result = await endListing(listing._id);
      if (result.error) {
        logger.warn(`[listingCtrl] eBay withdrawal failed for ${listing._id}: ${result.error}`);
      }
    }

    await listingService.deleteListing(req.params.id, req.tenantId);
    return success(res, null, "Listing deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.pushListing = async (req, res) => {
  try {
    const listing = await listingService.getListingById(req.params.id, req.tenantId);
    if (!listing) return notFound(res, "Listing not found");

    const product = listing.product && typeof listing.product === "object" ? listing.product : null;
    const errs = validateListingForPush(listing, product);
    if (errs.length > 0) return validationError(res, errs);

    await enqueueEbayJob("sync_listing", { listingId: listing._id.toString() });
    return success(res, { queued: true }, "Listing queued for eBay sync");
  } catch (err) {
    return systemfailure(res, err);
  }
};
