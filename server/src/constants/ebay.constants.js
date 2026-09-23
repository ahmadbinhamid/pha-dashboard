// constants/ebay.constants.js
// eBay OAuth scope identifiers, fixed by eBay's OAuth spec, never change between environments.

const EBAY_SCOPES = Object.freeze({
  SELL_INVENTORY: "https://api.ebay.com/oauth/api_scope/sell.inventory",
  SELL_ACCOUNT: "https://api.ebay.com/oauth/api_scope/sell.account",
  SELL_FULFILLMENT: "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  NOTIFICATION_SUBSCRIPTION: "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
  BASE: "https://api.ebay.com/oauth/api_scope",
});

// Named eBay Inventory/Offer API error codes branched on elsewhere, kept as a single source of truth.
const EBAY_ERROR_CODE = Object.freeze({
  // "createOffer" fails because an offer already exists; recovered via updateOffer with the returned offerId.
  OFFER_ALREADY_EXISTS: 25002,
  // "updateOffer" rejected because the offer is part of an active eBay sale/promotion — not a
  // hard failure, it self-resolves once the sale ends or allows price updates.
  PRICE_LOCKED_BY_ACTIVE_SALE: 25019,
  // "updateOffer" rejects a stored external_offer_id eBay no longer recognizes — either an
  // input-validation error or a 404; both mean this offerId is dead, recreate it.
  OFFER_NOT_FOUND_INPUT: 25604,
  OFFER_NOT_FOUND_RESOURCE: 25710,
});

// A tenant's eBay connection health, surfaced in Settings instead of a silently failing sync.
const EBAY_CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  TOKEN_EXPIRED: "token_expired",
  REVOKED: "revoked",
  ERROR: "error",
});

// Every eBay marketplace the UI lets a tenant pick, mapped to its transaction currency.
// Previously hardcoded "AUD" regardless, mislabeling non-AU marketplace orders. Found live.
// Order import prefers eBay's own reported currency and only falls back to this map.
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
  EBAY_CONNECTION_STATUS,
  EBAY_MARKETPLACE_CURRENCY,
  EBAY_TITLE_MAX_LENGTH,
  currencyForMarketplace,
};
