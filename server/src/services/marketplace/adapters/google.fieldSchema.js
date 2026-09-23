// services/marketplace/adapters/google.fieldSchema.js
// What Google needs beyond the product — ONLY listing fields google.adapter.js reads.
//
// NOTE: feed_label/content_language are omitted: the adapter reads them from the tenant's
// ChannelConnection (chosen once at connect), never the listing. custom_label_0..4 are read
// but no route can set them (google.listing.validation.js strips them), so they aren't offered.
// Identifiers: gtin wins; else mpn + brand (brand always comes from the product/eBay listing).

const { FIELD_TYPE } = require("../../../constants/channelField.constants");

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
    helpText: "Defaults to new.",
    optionsSource: "google.conditions",
    group: "condition",
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

function fieldValues(listing, { categoryId = listing.google_product_category } = {}) {
  return {
    google_product_category: categoryId,
    condition: listing.condition,
    gtin: listing.gtin,
    mpn: listing.mpn,
    shipping_label: listing.shipping_label,
  };
}

module.exports = { fieldSchema, fieldValues };
