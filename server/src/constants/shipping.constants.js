// constants/shipping.constants.js
// Storefront shipping methods and Transdirect API settings.

// standard: product.shipping_cost per unit; calculated: Transdirect quote.
const SHIPPING_METHOD = Object.freeze({ STANDARD: "standard", CALCULATED: "calculated" });
const ADDRESS_TYPE = Object.freeze({ BUSINESS: "business", RESIDENTIAL: "residential" });

const TRANSDIRECT = Object.freeze({
  BASE_URL: "https://www.transdirect.com.au/api",
  TIMEOUT_MS: 10_000,
  COUNTRY: "AU",
  // Transdirect item units, matching Product.package (cm and kg).
  ITEM_DESCRIPTION: "carton",
});

// Reused at order time so the checkout price matches the quote shown.
const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;

module.exports = { SHIPPING_METHOD, ADDRESS_TYPE, TRANSDIRECT, QUOTE_CACHE_TTL_MS };
