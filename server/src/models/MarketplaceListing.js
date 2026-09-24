// models/MarketplaceListing.js
// Listing base + platform discriminators; buildSchema drops discriminatorKey.

const { model, Schema } = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete.plugin");
const { stripInternalFields } = require("./base.model");
const {
  MARKETPLACE_PLATFORM,
  LISTING_STATE,
  LISTING_SYNC_STATUS,
} = require("../constants/marketplace.constants");

// -- Base schema --

const baseSchema = new Schema(
  {
    // Denormalized from product so tenant scoping needs no populate.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variant: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },

    // Per-channel overrides; null/empty => inherit from Product at publish time
    title_override: { type: String, default: null },
    description_override: { type: String, default: null },
    price_override: { type: Number, default: null },
    photo_overrides: [{ type: Schema.Types.ObjectId, ref: "Attachment" }],

    // Lifecycle state
    state: {
      type: String,
      enum: Object.values(LISTING_STATE),
      default: LISTING_STATE.DRAFT,
    },

    // Sync state — shared across all platforms
    sync_status: {
      type: String,
      enum: Object.values(LISTING_SYNC_STATUS),
      default: LISTING_SYNC_STATUS.NOT_LISTED,
    },
    synced_at: { type: Date, default: null },
    sync_error: { type: String, default: null },

    // Quantity-push fencing tokens for all platforms; legacy docs coalesce `?? 0`.
    push_seq: { type: Number, default: 0 },
    last_pushed_seq: { type: Number, default: 0 },

    // Loop-prevention qty baseline. TODO(dual-write): drop ebay_synced_quantity.
    synced_quantity: { type: Number, default: null },

    // Generic external identifiers (eBay listingId/offerId, Amazon ASIN, etc.)
    external_listing_id: { type: String, default: null },
    external_offer_id: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    discriminatorKey: "platform",
  },
);

baseSchema.plugin(softDeletePlugin);
baseSchema.set("toJSON", { transform: stripInternalFields });
baseSchema.set("toObject", { transform: stripInternalFields });

// One per (product, variant, platform); null variant counts as a value.
baseSchema.index(
  { product: 1, variant: 1, platform: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted_at: null },
  },
);

// No two docs on one eBay offer; partial, not sparse, as DRAFTs store null.
baseSchema.index(
  { external_listing_id: 1 },
  {
    unique: true,
    partialFilterExpression: { external_listing_id: { $type: "string" }, deleted_at: null },
  },
);
baseSchema.index(
  { external_offer_id: 1 },
  {
    unique: true,
    partialFilterExpression: { external_offer_id: { $type: "string" }, deleted_at: null },
  },
);

// Channel-agnostic health/count/recent-sync queries; background builds.
baseSchema.index({ tenant_id: 1, platform: 1, sync_status: 1 }, { background: true });
baseSchema.index({ tenant_id: 1, platform: 1, synced_at: -1 }, { background: true });
// Covers getPlatformChannelHealth's { tenant_id, platform, state } filter.
baseSchema.index({ tenant_id: 1, platform: 1, state: 1 }, { background: true });
// listListings sorts/groups by created_at/updated_at; avoids in-memory sorts.
baseSchema.index({ tenant_id: 1, created_at: -1 }, { background: true });
baseSchema.index({ tenant_id: 1, updated_at: -1 }, { background: true });

const MarketplaceListing = model("MarketplaceListing", baseSchema);

// -- eBay discriminator --

const ebaySchema = new Schema({
  ebay_category_id: { type: String, default: null },
  store_category_id: { type: String, default: null },
  store_sku: { type: String, default: null },

  // Null = use the product's condition; set only as an eBay override.
  condition: { type: String, default: null },
  condition_notes: { type: String, default: "" },

  item_specifics: {
    brand: { type: String, default: null },
    mpn: { type: String, default: null },
    superseded_part_number: [{ type: String }],
    aspects: { type: Map, of: String, default: {} },
    authenticity: { type: String, default: null },
    warranty: { type: String, default: null },
  },

  fitment: [
    {
      make: { type: String, default: "" },
      model: { type: String, default: "" },
      model_code: { type: String, default: "" },
      year_from: { type: Number, default: null },
      year_to: { type: Number, default: null },
    },
  ],

  format: {
    type: String,
    enum: ["FIXED_PRICE", "AUCTION"],
    default: "FIXED_PRICE",
  },
  // null => derive from live inventory at publish time
  quantity_available: { type: Number, default: null },
  // DEPRECATED: use synced_quantity. TODO(dual-write): drop after backfill.
  ebay_synced_quantity: { type: Number, default: null },
  // Last time ebay_synced_quantity was confirmed by a real eBay API response.
  ebay_synced_at: { type: Date, default: null },
  // Consecutive polls missing on eBay; a streak is required before local delete.
  ebay_missing_polls: { type: Number, default: 0 },
  // Drift awaiting a 2nd poll; eBay reads lag sales, so one-off drift is ignored.
  ebay_pending_reconcile_qty: { type: Number, default: null },
  listing_duration: { type: String, default: "GTC" },
  accept_best_offer: { type: Boolean, default: false },
  min_best_offer: { type: Number, default: null },

  // Business policy IDs — null => fall back to EbaySettings singleton defaults
  fulfillment_policy_id: { type: String, default: null },
  payment_policy_id: { type: String, default: null },
  return_policy_id: { type: String, default: null },
  require_immediate_payment: { type: Boolean, default: true },

  item_location_zip: { type: String, default: null },
  package: {
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    weight: { type: Number, default: null },
  },
});

MarketplaceListing.discriminator(MARKETPLACE_PLATFORM.EBAY, ebaySchema);

// -- Google: external_listing_id = Merchant resource name; no offer id --
const googleSchema = new Schema({
  // Google taxonomy id; distinct from eBay's category id.
  google_product_category: { type: String, default: null },
  gtin: { type: String, default: null },
  mpn: { type: String, default: null },
  // Google's lowercase condition enum, separate from eBay's ConditionEnum.
  condition: { type: String, default: null },
  feed_label: { type: String, default: null },
  content_language: { type: String, default: null },
  shipping_label: { type: String, default: null },
  custom_label_0: { type: String, default: null },
  custom_label_1: { type: String, default: null },
  custom_label_2: { type: String, default: null },
  custom_label_3: { type: String, default: null },
  custom_label_4: { type: String, default: null },
});

MarketplaceListing.discriminator(MARKETPLACE_PLATFORM.GOOGLE, googleSchema);

module.exports = MarketplaceListing;
