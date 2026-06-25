// constants/marketplace.constants.js

const MARKETPLACE_PLATFORM = Object.freeze({
  EBAY: "ebay",
  AMAZON: "amazon",   // future
  SHOPIFY: "shopify", // future
});

const LISTING_STATE = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ENDED: "ended",
});

// Superset of the legacy EBAY_SYNC_STATUS values on Product so the
// inventory-list cache stays forward-compatible.
const LISTING_SYNC_STATUS = Object.freeze({
  NOT_LISTED: "not_listed",
  PENDING: "pending",
  SYNCED: "synced",
  OUT_OF_STOCK: "out_of_stock",
  ERROR: "error",
});

module.exports = { MARKETPLACE_PLATFORM, LISTING_STATE, LISTING_SYNC_STATUS };
