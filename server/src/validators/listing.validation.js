// validators/listing.validation.js
// Mirrors ebay.listing.validation.js's listListings query shape, minus platform hardcoding —
// this generic layer exists alongside, not instead of, each platform's own create/update validators.

const Joi = require("joi");
const { LISTING_STATE, LISTING_SYNC_STATUS, MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

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
    // "Needs attention" tab; expands server-side to sync_status in [error, price_locked] and
    // takes precedence over a plain sync_status if both are sent.
    needs_attention: Joi.boolean(),
    search: Joi.string().allow(""),
    // One row per product with listings nested, instead of per listing. A query flag on the
    // existing endpoint, so callers omitting it keep the unchanged response shape.
    group_by: Joi.string().valid("product"),
  }),
};

module.exports = { listListings };
