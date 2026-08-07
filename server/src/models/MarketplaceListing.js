// models/MarketplaceListing.js
//
// Base model + discriminators for per-platform listings.
// buildSchema is not used here because it doesn't forward discriminatorKey.
// We apply the soft-delete plugin and timestamps manually to match conventions.

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
    // Denormalized from product.tenant_id at creation — avoids a populate
    // just to scope admin list/read queries by tenant.
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

// One listing per (product, variant, platform). A null variant is a distinct
// value in MongoDB sparse compound indexes — we rely on partial filtering here
// to treat null as a concrete value so (productA, null, ebay) is unique.
baseSchema.index(
  { product: 1, variant: 1, platform: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted_at: null },
  },
);

// Safety net against duplicate eBay offers/listings ending up attached to two
// different MarketplaceListing docs (e.g. a retried sync recreating an offer
// whose ID was never persisted) — found live as the root cause of a runaway
// stock-drift incident (Aug 2026): two DRAFT listings for the same product
// both independently recovered onto the same real eBay offer via the
// "offer already exists" retry path, and nothing in the DB stopped it.
//
// `sparse: true` does NOT correctly exclude these fields' null state —
// sparse only skips documents where the field is entirely ABSENT, but every
// DRAFT listing has this field explicitly set to `null` (present, not
// absent), so a plain sparse+unique index still collides every draft
// against every other draft. Use partialFilterExpression instead, which can
// actually test the VALUE (not just presence) and correctly excludes null.
// Also excludes soft-deleted docs (same as the compound index above) — an
// ended/removed listing's old external id shouldn't block a live one from
// ever using it, and old soft-deleted test/junk data shouldn't either.
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
  // Last quantity we know eBay actually has for this SKU — set whenever we
  // push a quantity (publish/update/pushInventory) or reconcile from a poll.
  // null until the first push/reconcile establishes a baseline. Comparing
  // eBay's live quantity against this value (not against local stock
  // directly) is what lets the inventory-sync poller tell "eBay changed
  // since we last touched it" apart from "we're the ones who changed it".
  ebay_synced_quantity: { type: Number, default: null },
  // When ebay_synced_quantity was last confirmed by an actual eBay API
  // response (a successful push, or a reconciliation poll's read) — not a
  // guess. Informational/debugging aid for the reconciliation flow.
  ebay_synced_at: { type: Date, default: null },
  // Consecutive inventory-sync polls where this listing's SKU was absent
  // from eBay's own inventory list — i.e. it was deleted/ended directly on
  // eBay, not through this app. Reset to 0 whenever it's seen again; a small
  // streak (not a single miss) is required before we auto-delete locally, so
  // one transient eBay API hiccup can't wrongly delete a live listing.
  ebay_missing_polls: { type: Number, default: 0 },
  // A quantity drift seen by the inventory-sync poller that hasn't yet been
  // confirmed on a second consecutive poll — see ebay_missing_polls above
  // for the same debounce idea applied to a different signal. eBay's own
  // GetInventoryItem API can lag behind an order it JUST processed (found
  // live: a sale dropped local stock 1->0, eBay's API still read 1 for
  // several minutes after), which used to look identical to a seller
  // manually raising the quantity in Seller Hub and get "corrected" back —
  // silently undoing a real sale. Requiring the same drift to still be
  // there on the NEXT poll (~15 min later, long enough for eBay's read side
  // to catch up) before applying it filters that false positive out while
  // still catching genuine manual edits, just one cycle later.
  ebay_pending_reconcile_qty: { type: Number, default: null },
  // Fencing token for outbound quantity pushes — incremented atomically
  // every time a push is enqueued (see order-stock-sync.service.js /
  // ebay.adapter.js#pushInventory). If two pushes for the same listing are
  // ever in flight at once (a retry racing a newer push), the worker
  // compares the job's seq against last_pushed_seq and drops anything
  // older than what's already landed — without this, an out-of-order retry
  // could silently overwrite a newer, correct quantity with a stale one.
  // Standard fencing-token pattern for idempotent, order-sensitive async
  // writers (Kleppmann, "Designing Data-Intensive Applications" ch. 9).
  push_seq: { type: Number, default: 0 },
  last_pushed_seq: { type: Number, default: 0 },
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

module.exports = MarketplaceListing;
