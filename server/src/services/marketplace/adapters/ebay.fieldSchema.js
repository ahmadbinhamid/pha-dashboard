// services/marketplace/adapters/ebay.fieldSchema.js
// eBay-only listing fields the payload reads. NOTE: unsent ones are omitted.

const { FIELD_TYPE } = require("../../../constants/channelField.constants");
const { EBAY_TITLE_MAX_LENGTH } = require("../../../constants/ebay.constants");
const { resolveCondition } = require("../productFallbacks");

const POLICY_HELP = "Leave empty to use your eBay default (Settings › eBay).";

const fieldSchema = Object.freeze([
  {
    key: "ebay_category_id",
    label: "eBay category",
    type: FIELD_TYPE.CATEGORY,
    required: true,
    helpText: "Defaults to your category mapping (Settings › Channel Categories).",
    optionsSource: "ebay.categorySearch",
    group: "category",
  },
  {
    key: "condition",
    label: "Condition",
    type: FIELD_TYPE.SELECT,
    required: true,
    optionsSource: "ebay.conditions",
    group: "condition",
    // Null on the listing means "use the product's"; set only to override.
    inheritsFrom: "condition",
  },
  {
    key: "condition_notes",
    label: "Condition notes",
    type: FIELD_TYPE.TEXTAREA,
    required: false,
    helpText: "Shown to buyers in the eBay description.",
    group: "condition",
  },
  {
    key: "item_specifics",
    label: "Item specifics",
    type: FIELD_TYPE.CUSTOM,
    required: false,
    helpText: "Brand (falls back to the product's), MPN, superseded part numbers and category aspects.",
    optionsSource: "ebay.categoryAspects",
    group: "specifics",
  },
  // Description fitment table; empty inherits product.vehicle (aspects always).
  {
    key: "fitment",
    label: "Vehicle fitment",
    type: FIELD_TYPE.CUSTOM,
    required: false,
    helpText: "Listed in the eBay description's compatibility table.",
    group: "fitment",
    inheritsFrom: "vehicle",
  },
  {
    key: "fulfillment_policy_id",
    label: "Shipping policy",
    type: FIELD_TYPE.POLICY,
    required: true,
    helpText: POLICY_HELP,
    optionsSource: "ebay.businessPolicies.fulfillment",
    group: "policies",
  },
  {
    key: "payment_policy_id",
    label: "Payment policy",
    type: FIELD_TYPE.POLICY,
    required: true,
    helpText: POLICY_HELP,
    optionsSource: "ebay.businessPolicies.payment",
    group: "policies",
  },
  {
    key: "return_policy_id",
    label: "Return policy",
    type: FIELD_TYPE.POLICY,
    required: true,
    helpText: POLICY_HELP,
    optionsSource: "ebay.businessPolicies.return",
    group: "policies",
  },
  { key: "package", label: "Package size & weight", type: FIELD_TYPE.CUSTOM, required: false, group: "shipping" },
  { key: "format", label: "Format", type: FIELD_TYPE.SELECT, required: false, optionsSource: "ebay.formats", group: "format" },
  { key: "accept_best_offer", label: "Accept best offers", type: FIELD_TYPE.BOOLEAN, required: false, group: "format" },
  {
    key: "min_best_offer",
    label: "Auto-decline offers below (AUD)",
    type: FIELD_TYPE.NUMBER,
    required: false,
    helpText: "Only used when best offers are accepted.",
    group: "format",
  },
  {
    key: "store_sku",
    label: "eBay SKU",
    type: FIELD_TYPE.TEXT,
    required: false,
    helpText: "Defaults to the product SKU. Changing it on a live listing creates a new eBay item.",
    group: "advanced",
  },
]);

// Limits on product-derived values (checked on the effective value).
const productConstraints = Object.freeze({ title: { maxLength: EBAY_TITLE_MAX_LENGTH } });

// Empty listing MPN inherits the product's (set only to override).
function effectiveMpn(listing, product) {
  return listing.item_specifics?.mpn || product?.mpn || null;
}

// Effective value per key (category -> mapping, policies -> tenant default).
function fieldValues(listing, { categoryId = listing.ebay_category_id, settings = null, product = null } = {}) {
  return {
    ebay_category_id: categoryId,
    condition: resolveCondition(listing, product),
    condition_notes: listing.condition_notes,
    item_specifics: listing.item_specifics,
    fitment: listing.fitment,
    fulfillment_policy_id: listing.fulfillment_policy_id || settings?.fulfillment_policy_id,
    payment_policy_id: listing.payment_policy_id || settings?.payment_policy_id,
    return_policy_id: listing.return_policy_id || settings?.return_policy_id,
    package: listing.package,
    format: listing.format,
    accept_best_offer: listing.accept_best_offer,
    min_best_offer: listing.min_best_offer,
    store_sku: listing.store_sku,
  };
}

// Rule groups by when the adapter enforces them.
const UPFRONT_KEYS = Object.freeze(["condition", "format", "accept_best_offer", "min_best_offer"]);
const POLICY_KEYS = Object.freeze(["fulfillment_policy_id", "payment_policy_id", "return_policy_id"]);

module.exports = {
  fieldSchema,
  productConstraints,
  fieldValues,
  effectiveMpn,
  UPFRONT_KEYS,
  POLICY_KEYS,
};
