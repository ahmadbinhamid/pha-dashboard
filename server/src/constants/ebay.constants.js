// constants/ebay.constants.js
// eBay OAuth scope identifiers — fixed strings defined by eBay's OAuth spec,
// never change between sandbox and production.

const EBAY_SCOPES = Object.freeze({
  SELL_INVENTORY: "https://api.ebay.com/oauth/api_scope/sell.inventory",
  SELL_ACCOUNT: "https://api.ebay.com/oauth/api_scope/sell.account",
  SELL_FULFILLMENT: "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  NOTIFICATION_SUBSCRIPTION: "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
  BASE: "https://api.ebay.com/oauth/api_scope",
});

// Named eBay Inventory/Offer API error codes we branch on elsewhere in the
// codebase — kept here as a single source of truth instead of the magic
// numbers previously scattered across comments in ebay.adapter.js.
const EBAY_ERROR_CODE = Object.freeze({
  // "createOffer" fails because an offer already exists for the SKU —
  // recovered by switching to updateOffer with the offerId eBay reports back.
  OFFER_ALREADY_EXISTS: 25002,
  // "updateOffer" (price/quantity) rejected because the offer is currently
  // part of an active eBay sale/promotion — eBay blocks price revisions on
  // listings that are on sale rather than applying them. Not a hard failure:
  // the listing itself is untouched and still live, just not price-refreshed
  // until the sale ends or is configured to allow price updates.
  PRICE_LOCKED_BY_ACTIVE_SALE: 25019,
});

// A tenant's eBay connection health — surfaced in Settings so a revoked
// consent or a broken refresh shows up as a visible state, not a silently
// failing background sync.
const EBAY_CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  TOKEN_EXPIRED: "token_expired",
  REVOKED: "revoked",
  ERROR: "error",
});

// Every eBay marketplace this app's UI lets a tenant pick (EbaySettings.
// marketplace_id has no enum restricting it to AU) mapped to that
// marketplace's transaction currency. Listing publish (buildOfferFromResolved)
// and eBay order import (createOrderFromEbayOrder) previously hardcoded
// "AUD"/"aud" regardless of this setting — a tenant configured for a non-AU
// marketplace would get mislabeled order currency and, worse, listings
// published with a currency eBay likely rejects for that marketplace. Found
// live. Order import prefers the currency eBay's own order payload reports
// (see ebay.order.mapper.js) and only falls back to this map when that's
// absent; listing publish has no per-offer currency from eBay to prefer, so
// this map is the only source there.
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

module.exports = { EBAY_SCOPES, EBAY_ERROR_CODE, EBAY_CONNECTION_STATUS, EBAY_MARKETPLACE_CURRENCY, currencyForMarketplace };
