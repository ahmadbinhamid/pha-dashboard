// services/marketplace/listing.write.service.js
// Platform-agnostic listing create/update; platform prep via LISTING_WRITERS.

const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const ProductVariant = require("../../models/ProductVariant");
const { enqueueChannelJob } = require("../../queues/channel.queue");
const { logger } = require("../../loaders/logging");
const { httpError } = require("../../utils/http/httpError");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

// Platform services, not adapters: adapters stay DB-free translators.
const LISTING_WRITERS = Object.freeze({
  [MARKETPLACE_PLATFORM.EBAY]: require("../ebay/ebay.listing.service"),
  [MARKETPLACE_PLATFORM.GOOGLE]: require("../google/google.listing.service"),
});

const VARIANT_POPULATE = "display_name sku price attachments";

function hasListingWriter(platform) {
  return Object.hasOwn(LISTING_WRITERS, platform);
}

/** The stored platform of a tenant's listing, or null. */
async function findListingPlatform(id, tenantId) {
  const listing = await MarketplaceListing.findOne({ _id: id, tenant_id: tenantId }).select("platform").lean();
  return listing?.platform ?? null;
}

// NOTE: variant ownership is new; a foreign variant used to be accepted.
async function assertOwnership(product, variant, tenantId) {
  const [ownsProduct, ownsVariant] = await Promise.all([
    Product.exists({ _id: product, tenant_id: tenantId }),
    variant ? ProductVariant.exists({ _id: variant, product, tenant_id: tenantId }) : true,
  ]);
  if (!ownsProduct) throw httpError("Product not found", 404);
  if (!ownsVariant) throw httpError("Variant not found", 404);
}

const findExisting = (platform, product, variant, tenantId) =>
  MarketplaceListing.findOne({ tenant_id: tenantId, product, variant, platform });

// Never fails a created listing over a queue hiccup; /:id/push can retry it.
async function enqueueFirstSync(platform, listing) {
  try {
    await enqueueChannelJob(platform, "sync_listing", { listingId: listing._id.toString(), seq: null });
  } catch (err) {
    logger.warn("[listing.write.service] failed to enqueue initial sync_listing after create", {
      listingId: listing._id.toString(),
      error: err.message,
    });
  }
}

// Idempotent: a repeat returns the first listing; E11000 returns the winner.
async function createOrReturnExisting(platform, writer, payload, tenantId) {
  const { product, variant = null } = payload;
  const existing = await findExisting(platform, product, variant, tenantId);
  if (existing) return existing;
  try {
    const listing = await MarketplaceListing.create({
      tenant_id: tenantId,
      platform,
      product,
      variant,
      ...writer.buildCreateFields(payload),
    });
    await writer.afterCreate?.(listing, payload, tenantId);
    return listing;
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.product) {
      const winner = await findExisting(platform, product, variant, tenantId);
      if (winner) return winner;
    }
    throw err;
  }
}

/** Creates or returns the listing; pushesOnCreate drives the reply text. */
async function createListing(platform, payload, tenantId) {
  const writer = LISTING_WRITERS[platform];
  await assertOwnership(payload.product, payload.variant ?? null, tenantId);
  const listing = await createOrReturnExisting(platform, writer, payload, tenantId);
  // NOTE: an idempotent repeat re-queues too, exactly as the Google route did.
  if (writer.PUSH_ON_CREATE) await enqueueFirstSync(platform, listing);
  return { listing, pushesOnCreate: writer.PUSH_ON_CREATE };
}

/** Updates a listing of this platform; null when there is none. */
async function updateListing(platform, id, payload, tenantId) {
  const writer = LISTING_WRITERS[platform];
  const update = await writer.buildUpdate(payload, tenantId);
  return MarketplaceListing.findOneAndUpdate({ _id: id, tenant_id: tenantId, platform }, { $set: update }, { new: true, strict: false })
    .populate("product", writer.UPDATE_PRODUCT_FIELDS)
    .populate("variant", VARIANT_POPULATE)
    .populate("photo_overrides");
}

module.exports = { hasListingWriter, findListingPlatform, createListing, updateListing };
