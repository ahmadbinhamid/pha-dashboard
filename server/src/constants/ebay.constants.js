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

module.exports = { EBAY_SCOPES, EBAY_ERROR_CODE };
