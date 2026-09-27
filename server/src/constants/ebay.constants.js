// constants/ebay.constants.js
// eBay OAuth scopes and API codes; fixed by eBay, same in every environment.

const EBAY_SCOPES = Object.freeze({
  SELL_INVENTORY: "https://api.ebay.com/oauth/api_scope/sell.inventory",
  SELL_ACCOUNT: "https://api.ebay.com/oauth/api_scope/sell.account",
  SELL_FULFILLMENT: "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  NOTIFICATION_SUBSCRIPTION: "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
  BASE: "https://api.ebay.com/oauth/api_scope",
});

// Inventory/Offer API error codes the adapter branches on.
const EBAY_ERROR_CODE = Object.freeze({
  // createOffer: offer exists; recovered via updateOffer on the returned id.
  OFFER_ALREADY_EXISTS: 25002,
  // Qty 0 on a live listing without seller "Out-of-stock control".
  INVALID_LISTING_QUANTITY: 25004,
  // updateOffer during an eBay sale; self-resolves when the sale ends.
  PRICE_LOCKED_BY_ACTIVE_SALE: 25019,
  // Stored offer id eBay no longer knows (validation error or 404): recreate.
  OFFER_NOT_FOUND_INPUT: 25604,
  OFFER_NOT_FOUND_RESOURCE: 25710,
});

// Offer listingStatus values a restock should relist; EBAY_ENDED is policy.
const EBAY_RELISTABLE_STATUSES = Object.freeze(["ENDED", "INACTIVE", "NOT_LISTED"]);

// Connection health shown in Settings instead of a silently failing sync.
const EBAY_CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  TOKEN_EXPIRED: "token_expired",
  REVOKED: "revoked",
  ERROR: "error",
});

// Marketplace currency; order import only falls back to this over eBay's own.
const EBAY_MARKETPLACE_CURRENCY = Object.freeze({
  EBAY_AU: "AUD",
  EBAY_US: "USD",
  EBAY_GB: "GBP",
  EBAY_DE: "EUR",
  EBAY_FR: "EUR",
  EBAY_IT: "EUR",
  EBAY_ES: "EUR",
  EBAY_CA: "CAD",
});

function currencyForMarketplace(marketplaceId) {
  return EBAY_MARKETPLACE_CURRENCY[marketplaceId] || "AUD";
}

// eBay's hard item-title limit.
const EBAY_TITLE_MAX_LENGTH = 80;

module.exports = {
  EBAY_SCOPES,
  EBAY_ERROR_CODE,
  EBAY_RELISTABLE_STATUSES,
  EBAY_CONNECTION_STATUS,
  EBAY_MARKETPLACE_CURRENCY,
  EBAY_TITLE_MAX_LENGTH,
  currencyForMarketplace,
};
