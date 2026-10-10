// constants/meta.constants.js
// Meta Graph / Catalog Batch API values, confirmed against Meta's docs.

// Platform throttling (4, 17, 32, 613) plus catalog batch/management BUC codes.
const META_THROTTLE_CODES = Object.freeze([4, 17, 32, 613, 80009, 80014]);
// Generic "unknown error" / "service temporarily unavailable": transient.
const META_TRANSIENT_CODES = Object.freeze([1, 2]);
// Invalid or expired access token (all subcodes).
const META_TOKEN_CODE = 190;
// Permission errors: the token no longer reaches the catalog.
const META_PERMISSION_CODES = Object.freeze([10, 200]);

const META_ITEM_TYPE = "PRODUCT_ITEM";
// UPDATE with allow_upsert (default true) creates or updates in one verb.
const META_BATCH_METHOD = Object.freeze({ UPSERT: "UPDATE", DELETE: "DELETE" });
// Only "finished" is documented; anything else is treated as still running.
const META_BATCH_DONE_STATUS = "finished";
// Documented items_batch cap is 5000; Meta recommends under 3000.
const META_BATCH_MAX_ITEMS = 3000;

const META_AVAILABILITY = Object.freeze({ IN_STOCK: "in stock", OUT_OF_STOCK: "out of stock" });
const META_CONDITIONS = Object.freeze(["new", "refurbished", "used"]);
// image_link and additional_image_link: JPEG or PNG, at least 500 x 500.
const META_MIN_IMAGE_PX = 500;
const META_MAX_ADDITIONAL_IMAGES = 20;

const META_OAUTH_STATE_PURPOSE = "meta_oauth";
const META_OAUTH_STATE_TTL = "10m";
// Days before a dated token's expiry that the UI starts asking to reconnect.
const META_TOKEN_RENEW_WARNING_DAYS = 7;

// Connect-flow err.code -> `reason` the frontend maps to friendly copy.
const META_CONNECT_ERROR_REASON = Object.freeze({
  CATALOG_NOT_ACCESSIBLE: "catalog_not_accessible",
  NO_PENDING_CONNECTION: "no_pending_connection",
});

// external_listing_id prefix; the base unique index spans every platform.
const META_EXTERNAL_ID_PREFIX = "meta";

module.exports = {
  META_THROTTLE_CODES,
  META_TRANSIENT_CODES,
  META_TOKEN_CODE,
  META_PERMISSION_CODES,
  META_ITEM_TYPE,
  META_BATCH_METHOD,
  META_BATCH_DONE_STATUS,
  META_BATCH_MAX_ITEMS,
  META_AVAILABILITY,
  META_CONDITIONS,
  META_MIN_IMAGE_PX,
  META_MAX_ADDITIONAL_IMAGES,
  META_OAUTH_STATE_PURPOSE,
  META_OAUTH_STATE_TTL,
  META_TOKEN_RENEW_WARNING_DAYS,
  META_EXTERNAL_ID_PREFIX,
  META_CONNECT_ERROR_REASON,
};
