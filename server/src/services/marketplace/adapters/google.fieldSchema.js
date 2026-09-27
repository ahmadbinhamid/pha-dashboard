// services/marketplace/adapters/google.fieldSchema.js
// NOTE: feed_label/content_language from connection; custom labels unsettable.

const { FIELD_TYPE, STATIC_FIELD_OPTIONS } = require("../../../constants/channelField.constants");

const fieldSchema = Object.freeze([
  {
    key: "google_product_category",
    label: "Google product category",
    type: FIELD_TYPE.CATEGORY,
    required: false,
    helpText: "Defaults to your category mapping; Google auto-categorises when unset.",
    optionsSource: "google.productCategories",
    group: "category",
  },
  {
    key: "condition",
    label: "Condition",
    type: FIELD_TYPE.SELECT,
    required: false,
    helpText: "Defaults to the product's condition.",
    optionsSource: "google.conditions",
    group: "condition",
    inheritsFrom: "condition",
  },
  {
    key: "gtin",
    label: "GTIN (barcode)",
    type: FIELD_TYPE.TEXT,
    required: false,
    helpText: "Sent in preference to MPN + brand.",
    group: "identifiers",
  },
  {
    key: "mpn",
    label: "MPN",
    type: FIELD_TYPE.TEXT,
    required: false,
    helpText: "Falls back to the product's MPN.",
    group: "identifiers",
  },
  {
    key: "shipping_label",
    label: "Shipping label",
    type: FIELD_TYPE.TEXT,
    required: false,
    helpText: "Must match a shipping rule label in Merchant Center.",
    group: "shipping",
  },
]);

const GOOGLE_CONDITIONS = new Set(STATIC_FIELD_OPTIONS["google.conditions"].map((o) => o.value));

// Product NEW/USED to Google's lowercase enum; Google overrides pass through.
function toGoogleCondition(value) {
  const lower = String(value ?? "").toLowerCase();
  return GOOGLE_CONDITIONS.has(lower) ? lower : "new";
}

// NOTE: condition validates only the stored Google override; fallback's mapped.
function fieldValues(listing, { categoryId = listing.google_product_category } = {}) {
  return {
    google_product_category: categoryId,
    condition: listing.condition,
    gtin: listing.gtin,
    mpn: listing.mpn,
    shipping_label: listing.shipping_label,
  };
}

module.exports = { fieldSchema, fieldValues, toGoogleCondition };
