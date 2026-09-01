// services/marketplace/sync.service.js
//
// Platform-agnostic sync dispatcher. Loads a MarketplaceListing by ID,
// resolves its content against the canonical Product (+ optional Variant),
// fetches platform settings via the adapter's own loadSettings, and
// delegates to the registered adapter. The adapter returns external IDs;
// this service writes them back to the listing.
//
// Also owns: the fencing check (last_pushed_seq), the ChannelSyncLog audit
// trail, and the per-tenant circuit breaker around every adapter call — see
// server/docs/channel-architecture.md.

const { logger } = require("../../loaders/logging");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const ProductVariant = require("../../models/ProductVariant");
const config = require("../../config");
const { getAdapter } = require("./registry");
const { resolveListing } = require("./listing.resolver");
const circuitBreaker = require("./circuitBreaker");
const { LISTING_STATE, LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

// Writes one ChannelSyncLog row. Never throws into the caller — a logging
// failure must never break the job it's describing (see
// models/ChannelSyncLog.js). Failures are always logged in full; successes
// (and skips, which aren't failures either) only when
// config.channels.logSuccesses is set, so a full catalogue sync doesn't
// write thousands of rows nobody reads.
async function logSyncEvent({ tenantId, platform, jobType, entityId, status, attempt, errorCode, errorMessage, requestSummary, durationMs }) {
  if (status !== CHANNEL_SYNC_LOG_STATUS.FAILURE && !config.channels.logSuccesses) return;
  try {
    await ChannelSyncLog.create({
      tenant_id: tenantId,
      platform,
      job_type: jobType,
      entity_type: "MarketplaceListing",
      entity_id: entityId,
      status,
      attempt: attempt ?? 1,
      error_code: errorCode ?? null,
      error_message: errorMessage ?? null,
      request_summary: requestSummary ?? null,
      duration_ms: durationMs ?? null,
    });
  } catch (err) {
    logger.warn(`[marketplace.sync] failed to write ChannelSyncLog for ${jobType}/${entityId}: ${err.message}`);
  }
}

// seq is the fencing token claimed at enqueue time (see
// inventory.service.js#fanOutMarketplaceInventory) — null/undefined for
// callers that don't participate in fencing (e.g. an explicit manual
// "resync this listing" action with no stock change behind it), in which
// case the sync always applies, same as before fencing existed.
async function syncListing(listingId, seq = null) {
  const listing = await MarketplaceListing.findById(listingId)
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate("photo_overrides");

  if (!listing) {
    logger.error(`[marketplace.sync] Listing not found: ${listingId}`);
    return { error: "Listing not found" };
  }

  // last_pushed_seq defaults to 0 on the base schema, but a legacy document
  // written before that migration can still read back `undefined` on a
  // lean/partial read — coalesce at every comparison site rather than rely
  // on Mongoose hydration defaults. See MarketplaceListing.js.
  const lastPushedSeq = listing.last_pushed_seq ?? 0;

  // A newer sync_listing job already landed for this listing (this one was
  // delayed and got overtaken) — applying it now would push a stale
  // quantity over a correct, more recent one. Drop it before doing any
  // work; not a failure, just moot. This is the ONE fence check for every
  // quantity push, now that there's only one writer path — see
  // ebay.adapter.js's module header comment.
  if (seq != null && seq < lastPushedSeq) {
    logger.info(
      `[marketplace.sync] dropping stale sync_listing job for ${listingId} (seq ${seq} < last_pushed ${lastPushedSeq})`,
    );
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "sync_listing",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
      errorCode: "stale_seq",
    });
    return { skipped: true, reason: "stale_seq" };
  }

  const adapter = getAdapter(listing.platform);

  // An adapter that's registered but whose tenant has no connection at all
  // must be a clean "not connected" outcome, never an unhandled rejection —
  // ONLY when the adapter actually implements loadSettings and it resolves
  // to null. loadSettings itself is guarded as optional (not assumed
  // present) because a minimal test double registered directly against the
  // registry (see sync.service.fencing.test.js) legitimately doesn't
  // implement the full adapter contract; an adapter with no loadSettings at
  // all just gets `undefined` passed through as settings; unchanged
  // behavior for that case rather than treating "no loadSettings method" the
  // same as "loadSettings resolved to null".
  let settings;
  if (typeof adapter.loadSettings === "function") {
    settings = await adapter.loadSettings(listing.product.tenant_id);
    if (settings === null) {
      logger.warn(`[marketplace.sync] listing ${listingId}: "${listing.platform}" has no connection for this tenant — skipping`);
      await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.ERROR, sync_error: "Platform not connected" });
      await logSyncEvent({
        tenantId: listing.tenant_id,
        platform: listing.platform,
        jobType: "sync_listing",
        entityId: listing._id,
        status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
        errorCode: "not_connected",
      });
      return { skipped: true, reason: "not_connected" };
    }
  }

  // Per-tenant circuit breaker — see circuitBreaker.js for why this is a
  // per-(tenant, platform) gate rather than a literal Bull queue.pause()
  // (which would stall every OTHER tenant sharing that platform's queue).
  if (await circuitBreaker.isOpen(listing.tenant_id, listing.platform)) {
    logger.warn(`[marketplace.sync] listing ${listingId}: circuit open for ${listing.platform}/${listing.tenant_id} — skipping until resumed`);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "sync_listing",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
      errorCode: "circuit_open",
    });
    return { skipped: true, reason: "circuit_open" };
  }

  const isUpdate = !!listing.external_listing_id;

  // Capability guard: an adapter that can't push inventory at all (a
  // catalog-only platform, or one not yet built out) makes an inventory
  // refresh (i.e. this listing is already published — isUpdate) a no-op
  // rather than a crash. A first-time publish still goes through even if
  // inventory=false, since publish also carries title/price/photos, not
  // just quantity.
  const capabilities = adapter.capabilities || {};
  if (isUpdate && capabilities.inventory === false) {
    logger.warn(`[marketplace.sync] listing ${listingId}: adapter "${listing.platform}" has no inventory capability — sync_listing is a no-op`);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "sync_listing",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
      errorCode: "inventory_not_supported",
    });
    return { skipped: true, reason: "inventory_not_supported" };
  }

  const variant = listing.variant
    ? await ProductVariant.findById(listing.variant).populate("attachments")
    : null;

  const resolved = resolveListing(listing, listing.product, variant);

  await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.PENDING });
  logger.info(`[marketplace.sync] syncing listing ${listingId} on ${listing.platform} (sku: ${resolved.sku})`);

  const startedAt = Date.now();
  try {
    const hooks = {
      // Persist the offer ID as soon as it's known, not just at the end of
      // the whole call chain — otherwise a failure downstream (e.g. publish)
      // leaves this listing looking un-synced and a retry recreates the offer.
      onOfferCreated: (offerId) => listing.updateOne({ external_offer_id: offerId }),
    };
    const ids = isUpdate
      ? await adapter.update(resolved, settings, hooks, seq)
      : await adapter.publish(resolved, settings, hooks, seq);

    await circuitBreaker.recordSuccess(listing.tenant_id, listing.platform);

    // Determined AFTER the write succeeded, from what was actually pushed —
    // the adapter no longer refuses to push a 0 quantity (that used to mean
    // a manual "correct stock to 0" never reached eBay at all, and eBay
    // kept selling stock we don't have). ids.quantity is null for an
    // untracked-stock product (stock_control=false — see
    // ebay.adapter.js#resolveQuantity), in which case there's no
    // meaningful "out of stock" concept either.
    const outOfStock = ids.quantity === 0;

    // priceLocked (see ebay.adapter.js#updateOfferTolerant): everything else
    // about the sync succeeded, eBay just rejected the price/quantity
    // revision because the offer is part of an active sale. Not an error —
    // sync_error stays null (same convention as OUT_OF_STOCK) since the
    // PRICE_LOCKED status itself already communicates what's going on.
    await listing.updateOne({
      external_listing_id: ids.external_listing_id || listing.external_listing_id,
      external_offer_id: ids.external_offer_id || listing.external_offer_id,
      sync_status: outOfStock
        ? LISTING_SYNC_STATUS.OUT_OF_STOCK
        : ids.priceLocked
          ? LISTING_SYNC_STATUS.PRICE_LOCKED
          : LISTING_SYNC_STATUS.SYNCED,
      state: LISTING_STATE.ACTIVE,
      synced_at: new Date(),
      sync_error: null,
    });

    if (outOfStock) {
      logger.info(`[marketplace.sync] listing ${listingId} synced at quantity 0 — marked OUT_OF_STOCK`);
    } else if (ids.priceLocked) {
      logger.warn(`[marketplace.sync] listing ${listingId} synced, but price update was skipped (active eBay sale)`);
    } else {
      logger.info(`[marketplace.sync] listing ${listingId} synced successfully`);
    }

    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: isUpdate ? "update" : "publish",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SUCCESS,
      durationMs: Date.now() - startedAt,
    });

    return { ok: true, ...ids };
  } catch (err) {
    logger.error(`[marketplace.sync] listing ${listingId} sync failed: ${err.message}`);
    await listing.updateOne({
      sync_status: LISTING_SYNC_STATUS.ERROR,
      sync_error: err.message,
    });
    await circuitBreaker.recordFailure(listing.tenant_id, listing.platform, err);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: isUpdate ? "update" : "publish",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.FAILURE,
      errorMessage: err.message,
      durationMs: Date.now() - startedAt,
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
    await circuitBreaker.recordSuccess(listing.tenant_id, listing.platform);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "end",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SUCCESS,
    });
    return { ok: true };
  } catch (err) {
    logger.error(`[marketplace.sync] listing ${listingId} end failed: ${err.message}`);
    await circuitBreaker.recordFailure(listing.tenant_id, listing.platform, err);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "end",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.FAILURE,
      errorMessage: err.message,
    });
    return { error: err.message };
  }
}

module.exports = { syncListing, endListing };
