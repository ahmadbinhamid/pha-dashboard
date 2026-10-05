// validators/listing.validation.js
// Generic listing query, plus each platform's own create/update schema by key.

const Joi = require("joi");
const { LISTING_STATE, LISTING_SYNC_STATUS, MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");
const ebayV = require("./ebay.listing.validation");
const googleV = require("./google.listing.validation");

const listListings = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    product: Joi.string(),
    // Comma-separated product ids; bypasses pagination.
    product_in: Joi.string(),
    platform: Joi.string().valid(...Object.values(MARKETPLACE_PLATFORM)),
    state: Joi.string().valid(...Object.values(LISTING_STATE)),
    sync_status: Joi.string().valid(...Object.values(LISTING_SYNC_STATUS)),
    // Expands to sync_status in [error, price_locked]; beats a plain sync_status.
    needs_attention: Joi.boolean(),
    search: Joi.string().allow(""),
    // One row per product, listings nested; omitting it keeps the old shape.
    group_by: Joi.string().valid("product"),
  }),
};

// The existing per-platform schemas, reused unchanged.
const LISTING_WRITE_SCHEMAS = Object.freeze({
  [MARKETPLACE_PLATFORM.EBAY]: { create: ebayV.createListing, update: ebayV.updateListing },
  [MARKETPLACE_PLATFORM.GOOGLE]: { create: googleV.createListing, update: googleV.updateListing },
});

module.exports = { listListings, LISTING_WRITE_SCHEMAS };
