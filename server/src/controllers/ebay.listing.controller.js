// controllers/ebay.listing.controller.js

const listingService = require("../services/ebay/ebay.listing.service");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const {
  success,
  created,
  notFound,
  badRequest,
  systemfailure,
} = require("../utils/http/response");

exports.createListing = async (req, res) => {
  try {
    const { product } = req.body;
    if (!product) return badRequest(res, "product is required");

    const listing = await listingService.createListing(req.body);
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
    const listing = await listingService.getListingById(req.params.id);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, listing);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getListings = async (req, res) => {
  try {
    const { product, state, sync_status, page = 1, limit = 20 } = req.query;
    const result = await listingService.listListings({
      page: Number(page),
      limit: Number(limit),
      product,
      state,
      sync_status,
    });
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateListing = async (req, res) => {
  try {
    const listing = await listingService.updateListing(req.params.id, req.body);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, listing, "Listing updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const listing = await listingService.deleteListing(req.params.id);
    if (!listing) return notFound(res, "Listing not found");
    return success(res, null, "Listing deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.pushListing = async (req, res) => {
  try {
    const listing = await listingService.getListingById(req.params.id);
    if (!listing) return notFound(res, "Listing not found");

    await enqueueEbayJob("sync_listing", { listingId: listing._id.toString() });
    return success(res, { queued: true }, "Listing queued for eBay sync");
  } catch (err) {
    return systemfailure(res, err);
  }
};
