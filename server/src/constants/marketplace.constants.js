// constants/marketplace.constants.js

const MARKETPLACE_PLATFORM = Object.freeze({
  EBAY: "ebay",
  GOOGLE: "google",
  AMAZON: "amazon",   // future
  SHOPIFY: "shopify", // future
});

const LISTING_STATE = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ENDED: "ended",
});

// Superset of the legacy EBAY_SYNC_STATUS values, keeping the inventory-list cache forward-compatible.
const LISTING_SYNC_STATUS = Object.freeze({
  NOT_LISTED: "not_listed",
  PENDING: "pending",
  SYNCED: "synced",
  OUT_OF_STOCK: "out_of_stock",
  // Listing is live but eBay rejected the last price update since it's part of an active sale.
  // Distinct from ERROR: self-resolves once the sale ends or allows price updates.
  PRICE_LOCKED: "price_locked",
  ERROR: "error",
});

module.exports = { MARKETPLACE_PLATFORM, LISTING_STATE, LISTING_SYNC_STATUS };
