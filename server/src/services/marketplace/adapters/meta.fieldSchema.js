// services/marketplace/adapters/meta.fieldSchema.js
// Meta panel fields; Meta accepts Google's taxonomy, so options are shared.

const { FIELD_TYPE } = require("../../../constants/channel-field.constants");
const { META_CONDITIONS } = require("../../../constants/meta.constants");

// NOTE: required so an unmapped product fails loudly instead of uncategorised.
const fieldSchema = Object.freeze([
  {
    key: "meta_product_category",
    label: "Product category",
    type: FIELD_TYPE.CATEGORY,
    required: true,
    helpText: "Defaults to your Meta category mapping, else your Google mapping.",
    optionsSource: "google.productCategories",
    group: "category",
  },
  {
    key: "gtin",
    label: "GTIN (barcode)",
    type: FIELD_TYPE.TEXT,
    required: false,
    helpText: "Only if you're sure it's correct; MPN is sent otherwise.",
    group: "identifiers",
  },
]);

// Product NEW/USED to Meta's lowercase enum; unknown values fail, not guess.
function toMetaCondition(value) {
  const lower = String(value ?? "").toLowerCase();
  return META_CONDITIONS.includes(lower) ? lower : null;
}

function fieldValues(listing, { categoryId = listing.meta_product_category } = {}) {
  return { meta_product_category: categoryId, gtin: listing.gtin };
}

module.exports = { fieldSchema, fieldValues, toMetaCondition };
