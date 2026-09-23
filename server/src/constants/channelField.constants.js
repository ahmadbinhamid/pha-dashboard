// constants/channelField.constants.js
// Shared vocabulary for adapter fieldSchema descriptors (see services/marketplace/fieldSchema.js).

const { GOOGLE_AUTO_PARTS_CATEGORIES } = require("./googleProductCategory.constants");
const { PRODUCT_CONDITION } = require("./product.constants");

const FIELD_TYPE = Object.freeze({
  TEXT: "text",
  TEXTAREA: "textarea",
  NUMBER: "number",
  BOOLEAN: "boolean",
  SELECT: "select",
  CATEGORY: "category",
  POLICY: "policy",
  // Rendered by a dedicated frontend component keyed "<platform>.<key>".
  CUSTOM: "custom",
});

// Static option lists, keyed by descriptor.optionsSource. Dynamic sources (e.g. a tenant's
// eBay business policies) are absent here and resolved by the frontend via their own API.
const STATIC_FIELD_OPTIONS = Object.freeze({
  "ebay.conditions": [
    { value: PRODUCT_CONDITION.NEW, label: "New" },
    { value: PRODUCT_CONDITION.USED, label: "Used" },
  ],
  "ebay.formats": [
    { value: "FIXED_PRICE", label: "Buy It Now" },
    { value: "AUCTION", label: "Auction" },
  ],
  "google.conditions": [
    { value: "new", label: "New" },
    { value: "refurbished", label: "Refurbished" },
    { value: "used", label: "Used" },
  ],
  "google.productCategories": GOOGLE_AUTO_PARTS_CATEGORIES.map(({ id, name }) => ({ value: id, label: name })),
});

// Sources whose options are a closed set the server enforces. NOTE: ebay.conditions is not
// enforced — legacy listings hold raw eBay enums (e.g. USED_EXCELLENT) that eBay's own
// per-category policy check (ebay.adapter.js#resolveCategoryCondition) already validates.
// google.productCategories is a suggestion list; any Google taxonomy id is valid.
const ENFORCED_OPTION_SOURCES = Object.freeze(["ebay.formats", "google.conditions"]);

module.exports = { FIELD_TYPE, STATIC_FIELD_OPTIONS, ENFORCED_OPTION_SOURCES };
