// models/MarketplaceListing.js
// Base model + discriminators for per-platform listings. buildSchema isn't used since it
// doesn't forward discriminatorKey; soft-delete plugin and timestamps applied manually instead.

const { model, Schema } = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete.plugin");
const { stripInternalFields } = require("./base.model");
const {
  MARKETPLACE_PLATFORM,
  LISTING_STATE,
  LISTING_SYNC_STATUS,
} = require("../constants/marketplace.constants");

// ── Base schema ─────────────────────────────────────────────────────────────

const baseSchema = new Schema(
  {
    // Denormalized from product.tenant_id at creation, avoiding a populate to scope tenant queries.
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

    // Per-channel content overrides — null/empty => inherit from Product at publish time
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

    // Fencing tokens for outbound quantity pushes (standard fencing-token pattern for
    // idempotent async writers). Moved to the base schema so every platform gets a real token,
    // not just eBay — every comparison site coalesces with `?? 0` for legacy docs missing it.
    push_seq: { type: Number, default: 0 },
    last_pushed_seq: { type: Number, default: 0 },

    // Generic loop-prevention baseline: what we believe this platform shows, replacing the
    // eBay-only ebay_synced_quantity below long-term.
    // TODO(dual-write): drop ebay_synced_quantity once backfilled from this field.
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

// One listing per (product, variant, platform); partial filtering treats a null variant as a
// concrete value so (productA, null, ebay) is unique.
baseSchema.index(
  { product: 1, variant: 1, platform: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted_at: null },
  },
);

// Safety net against duplicate eBay offers attached to two different listing docs — found live
// as the root cause of a runaway stock-drift incident (Aug 2026): two DRAFT listings both
// recovered onto the same real eBay offer via the "offer already exists" retry path.
// sparse: true wouldn't work since every DRAFT has this field explicitly null (present, not
// absent); partialFilterExpression tests the value instead, correctly excluding null and soft-deleted docs.
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

// Channel-agnostic query patterns (health dashboards, per-platform counts, recently-synced views);
// background: true so index build never blocks writes in production.
baseSchema.index({ tenant_id: 1, platform: 1, sync_status: 1 }, { background: true });
baseSchema.index({ tenant_id: 1, platform: 1, synced_at: -1 }, { background: true });
// getPlatformChannelHealth filters on { tenant_id, platform, state }; previously only
// sync_status/synced_at were covered, leaving `state` outside every compound index above.
baseSchema.index({ tenant_id: 1, platform: 1, state: 1 }, { background: true });
// listListings/listListingsGroupedByProduct, the hottest read path in the marketplace feature,
// sort/group by created_at and updated_at; neither was previously covered, forcing an in-memory sort.
baseSchema.index({ tenant_id: 1, created_at: -1 }, { background: true });
baseSchema.index({ tenant_id: 1, updated_at: -1 }, { background: true });

const MarketplaceListing = model("MarketplaceListing", baseSchema);

// ── eBay discriminator ───────────────────────────────────────────────────────

const ebaySchema = new Schema({
  ebay_category_id: { type: String, default: null },
  store_category_id: { type: String, default: null },
  store_sku: { type: String, default: null },

  condition: { type: String, default: "NEW" },
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
  // What we currently believe eBay shows — a confirmed push OR our own best guess after an
  // eBay-originated sale (provably wrong on an oversell). Treat as belief, not verified fact.
  // DEPRECATED: superseded by the generic `synced_quantity` on the base schema.
  // TODO(dual-write): remove after ebay_synced_quantity backfill.
  ebay_synced_quantity: { type: Number, default: null },
  // When ebay_synced_quantity was last confirmed by a real eBay API response, not a guess.
  ebay_synced_at: { type: Date, default: null },
  // Consecutive polls where this SKU was absent from eBay's inventory list. Reset to 0 when
  // seen again; a streak (not a single miss) is required before auto-deleting locally.
  ebay_missing_polls: { type: Number, default: 0 },
  // A drift seen once but not yet confirmed on a second consecutive poll — eBay's read side can
  // lag behind a just-processed sale, which used to look like a manual raise and get "corrected"
  // back, undoing a real sale. Requiring it twice filters that false positive out.
  ebay_pending_reconcile_qty: { type: Number, default: null },
  // push_seq / last_pushed_seq moved to the base schema since sync.service.js reads them generically.
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

// ── Google (Merchant API) discriminator ──────────────────────────────────────
// Google is feed-shaped, no offer/publish lifecycle like eBay's. external_listing_id holds
// the Merchant API resource name; external_offer_id stays null (excluded by the base schema's
// partial unique index), so every Google listing sharing null doesn't collide.
const googleSchema = new Schema({
  // Google's own taxonomy id, a different concept from eBay's category id, not reused.
  google_product_category: { type: String, default: null },
  gtin: { type: String, default: null },
  mpn: { type: String, default: null },
  // Google's own lowercase condition enum, kept separate from eBay's ConditionEnum strings.
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
