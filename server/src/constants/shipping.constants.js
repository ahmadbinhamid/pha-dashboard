// constants/shipping.constants.js
// Storefront shipping methods and Transdirect API settings.

// standard: product.shipping_cost per unit; calculated: Transdirect quote.
const SHIPPING_METHOD = Object.freeze({ STANDARD: "standard", CALCULATED: "calculated" });
const ADDRESS_TYPE = Object.freeze({ BUSINESS: "business", RESIDENTIAL: "residential" });

const TRANSDIRECT = Object.freeze({
  BASE_URL: "https://www.transdirect.com.au/api",
  TIMEOUT_MS: 10_000,
  COUNTRY: "AU",
  REFERRER: "api",
  // Packaging type per item; sizes are Product.package's cm and kg.
  ITEM_DESCRIPTION: "Parcel",
});

// Transdirect accepts only state codes; full names are mapped onto them.
const AU_STATE_CODES = Object.freeze(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
const AU_STATE_BY_NAME = Object.freeze({
  "AUSTRALIAN CAPITAL TERRITORY": "ACT",
  "NEW SOUTH WALES": "NSW",
  "NORTHERN TERRITORY": "NT",
  QUEENSLAND: "QLD",
  "SOUTH AUSTRALIA": "SA",
  TASMANIA: "TAS",
  VICTORIA: "VIC",
  "WESTERN AUSTRALIA": "WA",
});

// Reused at order time so the checkout price matches the quote shown.
const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;

module.exports = {
  SHIPPING_METHOD,
  ADDRESS_TYPE,
  TRANSDIRECT,
  AU_STATE_CODES,
  AU_STATE_BY_NAME,
  QUOTE_CACHE_TTL_MS,
};
