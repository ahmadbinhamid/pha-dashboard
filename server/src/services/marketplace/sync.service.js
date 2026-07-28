// services/marketplace/sync.service.js
//
// Platform-agnostic sync dispatcher. Loads a MarketplaceListing by ID,
// resolves its content against the canonical Product (+ optional Variant),
// fetches platform settings, and delegates to the registered adapter.
// The adapter returns external IDs; this service writes them back to the listing.

const { logger } = require("../../loaders/logging");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ProductVariant = require("../../models/ProductVariant");
const { getAdapter } = require("./registry");
const { resolveListing } = require("./listing.resolver");
const { loadSettings: loadEbaySettings } = require("../ebay/ebay.api.service");
const { LISTING_STATE, LISTING_SYNC_STATUS, MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

async function loadPlatformSettings(platform) {
  switch (platform) {
    case MARKETPLACE_PLATFORM.EBAY:
      return loadEbaySettings();
    default:
      throw new Error(`No settings loader registered for platform: ${platform}`);
  }
}

async function syncListing(listingId) {
  const listing = await MarketplaceListing.findById(listingId)
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate("photo_overrides");

  if (!listing) {
    logger.error(`[marketplace.sync] Listing not found: ${listingId}`);
    return { error: "Listing not found" };
  }

  const adapter = getAdapter(listing.platform);
  const variant = listing.variant
    ? await ProductVariant.findById(listing.variant).populate("attachments")
    : null;

  const resolved = resolveListing(listing, listing.product, variant);
  const settings = await loadPlatformSettings(listing.platform);

  await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.PENDING });
  logger.info(`[marketplace.sync] syncing listing ${listingId} on ${listing.platform} (sku: ${resolved.sku})`);

  try {
    const isUpdate = !!listing.external_listing_id;
    const hooks = {
      // Persist the offer ID as soon as it's known, not just at the end of
      // the whole call chain — otherwise a failure downstream (e.g. publish)
      // leaves this listing looking un-synced and a retry recreates the offer.
      onOfferCreated: (offerId) => listing.updateOne({ external_offer_id: offerId }),
    };
    const ids = isUpdate
      ? await adapter.update(resolved, settings, hooks)
      : await adapter.publish(resolved, settings, hooks);

    if (ids.skipped && ids.reason === "out_of_stock") {
      await listing.updateOne({
        sync_status: LISTING_SYNC_STATUS.OUT_OF_STOCK,
        sync_error: null,
      });
      return { skipped: true, reason: "out_of_stock" };
    }

    // priceLocked (see ebay.adapter.js#updateOfferTolerant): everything else
    // about the sync succeeded, eBay just rejected the price/quantity
    // revision because the offer is part of an active sale. Not an error —
    // sync_error stays null (same convention as OUT_OF_STOCK) since the
    // PRICE_LOCKED status itself already communicates what's going on.
    await listing.updateOne({
      external_listing_id: ids.external_listing_id || listing.external_listing_id,
      external_offer_id: ids.external_offer_id || listing.external_offer_id,
      sync_status: ids.priceLocked ? LISTING_SYNC_STATUS.PRICE_LOCKED : LISTING_SYNC_STATUS.SYNCED,
      state: LISTING_STATE.ACTIVE,
      synced_at: new Date(),
      sync_error: null,
    });

    if (ids.priceLocked) {
      logger.warn(`[marketplace.sync] listing ${listingId} synced, but price update was skipped (active eBay sale)`);
    } else {
      logger.info(`[marketplace.sync] listing ${listingId} synced successfully`);
    }
    return { ok: true, ...ids };
  } catch (err) {
    logger.error(`[marketplace.sync] listing ${listingId} sync failed: ${err.message}`);
    await listing.updateOne({
      sync_status: LISTING_SYNC_STATUS.ERROR,
      sync_error: err.message,
    });
    throw err;
  }
}

async function endListing(listingId) {
  const listing = await MarketplaceListing.findById(listingId)
    .populate("product", "_id sku");

  if (!listing) return { error: "Listing not found" };

  if (!listing.external_listing_id && !listing.external_offer_id) {
    return { skipped: true, reason: "never_synced" };
  }

  const adapter = getAdapter(listing.platform);

  try {
    await adapter.end(listing);
    logger.info(`[marketplace.sync] listing ${listingId} ended on ${listing.platform}`);
    return { ok: true };
  } catch (err) {
    logger.error(`[marketplace.sync] listing ${listingId} end failed: ${err.message}`);
    return { error: err.message };
  }
}

module.exports = { syncListing, endListing };
