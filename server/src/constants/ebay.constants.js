// constants/ebay.constants.js
// eBay OAuth scope identifiers — fixed strings defined by eBay's OAuth spec,
// never change between sandbox and production.

const EBAY_SCOPES = Object.freeze({
  SELL_INVENTORY: "https://api.ebay.com/oauth/api_scope/sell.inventory",
  SELL_ACCOUNT: "https://api.ebay.com/oauth/api_scope/sell.account",
  NOTIFICATION_SUBSCRIPTION: "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
  BASE: "https://api.ebay.com/oauth/api_scope",
});

module.exports = { EBAY_SCOPES };
