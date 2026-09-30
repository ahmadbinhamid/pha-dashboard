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

// Superset of legacy EBAY_SYNC_STATUS, so the inventory-list cache still reads.
const LISTING_SYNC_STATUS = Object.freeze({
  NOT_LISTED: "not_listed",
  PENDING: "pending",
  SYNCED: "synced",
  OUT_OF_STOCK: "out_of_stock",
  // Live, but eBay refused a price update during a sale; clears after the sale.
  PRICE_LOCKED: "price_locked",
  ERROR: "error",
});

// A push that landed; out_of_stock is a successful quantity-0 push.
const LISTING_SUCCESS_STATUSES = Object.freeze([LISTING_SYNC_STATUS.SYNCED, LISTING_SYNC_STATUS.OUT_OF_STOCK]);

// What the Channel sync page counts as "Needs Attention".
const LISTING_NEEDS_ATTENTION_STATUSES = Object.freeze([LISTING_SYNC_STATUS.ERROR, LISTING_SYNC_STATUS.PRICE_LOCKED]);

module.exports = {
  MARKETPLACE_PLATFORM,
  LISTING_STATE,
  LISTING_SYNC_STATUS,
  LISTING_SUCCESS_STATUSES,
  LISTING_NEEDS_ATTENTION_STATUSES,
};
