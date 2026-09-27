// constants/channelField.constants.js
// Shared vocabulary for adapter fieldSchema descriptors.

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
  // Rendered by a frontend component keyed "<platform>.<key>".
  CUSTOM: "custom",
});

// Static options by optionsSource; dynamic ones (eBay policies) are fetched by the UI.
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

// Closed sets the server enforces. NOTE: not ebay.conditions (legacy raw eBay enums).
const ENFORCED_OPTION_SOURCES = Object.freeze(["ebay.formats", "google.conditions"]);

module.exports = { FIELD_TYPE, STATIC_FIELD_OPTIONS, ENFORCED_OPTION_SOURCES };
