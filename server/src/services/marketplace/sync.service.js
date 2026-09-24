// services/marketplace/sync.service.js
// Adapter sync dispatcher: fencing, ChannelSyncLog audit and circuit breaker.

const { logger } = require("../../loaders/logging");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const Product = require("../../models/Product");
const ProductVariant = require("../../models/ProductVariant");
const config = require("../../config");
const { getAdapter } = require("./registry");
const { resolveListing, resolveSku, hydrateResolved } = require("./listing.resolver");
const circuitBreaker = require("./circuitBreaker");
const { ensurePrerequisites, flagIfPrerequisiteError } = require("./channelPrerequisite.service");
const { LISTING_STATE, LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

// Never throws: a log failure mustn't break the job; non-failures are opt-in.
async function logSyncEvent({ tenantId, platform, jobType, entityId, status, attempt, errorCode, errorMessage, errorStatus, requestSummary, durationMs }) {
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
      error_status: Number.isInteger(errorStatus) ? errorStatus : null,
      request_summary: requestSummary ?? null,
      duration_ms: durationMs ?? null,
    });
  } catch (err) {
    logger.warn(`[marketplace.sync] failed to write ChannelSyncLog for ${jobType}/${entityId}: ${err.message}`);
  }
}

// Logs a sync_listing skip; branch-specific listing updates are the caller's.
async function skipSync(listing, reason) {
  await logSyncEvent({
    tenantId: listing.tenant_id,
    platform: listing.platform,
    jobType: "sync_listing",
    entityId: listing._id,
    status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
    errorCode: reason,
  });
  return { skipped: true, reason };
}

// Stamps the sync baseline after a push; updateMany keeps duplicates in step.
async function recordQuantityPushed(listing, adapter, quantity, seq) {
  await MarketplaceListing.updateMany(
    { tenant_id: listing.tenant_id, product: listing.product._id, variant: listing.variant || null, platform: listing.platform },
    {
      $set: {
        ...(adapter.syncBaselineFields?.(quantity) || {}),
        synced_quantity: quantity,
        synced_at: new Date(),
        ...(seq != null ? { last_pushed_seq: seq } : {}),
      },
    },
    // strict:false, or base-model updates drop discriminator-only ebay_* fields.
    { strict: false },
  );
}

// seq: fencing token from enqueue; null (e.g. manual resync) always applies.
async function syncListing(listingId, seq = null) {
  const listing = await MarketplaceListing.findById(listingId)
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate("photo_overrides");

  if (!listing) {
    logger.error(`[marketplace.sync] Listing not found: ${listingId}`);
    return { error: "Listing not found" };
  }

  // Legacy docs can read back undefined, so coalesce rather than trust defaults.
  const lastPushedSeq = listing.last_pushed_seq ?? 0;

  // Overtaken by a newer job; the sole fence check for every quantity push.
  if (seq != null && seq < lastPushedSeq) {
    logger.info(
      `[marketplace.sync] dropping stale sync_listing job for ${listingId} (seq ${seq} < last_pushed ${lastPushedSeq})`,
    );
    return skipSync(listing, "stale_seq");
  }

  const adapter = getAdapter(listing.platform);

  // Only a null loadSettings means not connected; test doubles may lack it.
  let settings;
  if (typeof adapter.loadSettings === "function") {
    settings = await adapter.loadSettings(listing.product.tenant_id);
    if (settings === null) {
      logger.warn(`[marketplace.sync] listing ${listingId}: "${listing.platform}" has no connection for this tenant — skipping`);
      await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.ERROR, sync_error: "Platform not connected" });
      return skipSync(listing, "not_connected");
    }
  }

  // Per-tenant gate, not queue.pause(), which would stall other tenants.
  if (await circuitBreaker.isOpen(listing.tenant_id, listing.platform)) {
    logger.warn(`[marketplace.sync] listing ${listingId}: circuit open for ${listing.platform}/${listing.tenant_id} — skipping until resumed`);
    return skipSync(listing, "circuit_open");
  }

  // NOTE: skipped, not failed: a missing prerequisite isn't a broken integration.
  const unmet = await ensurePrerequisites({
    tenantId: listing.tenant_id, platform: listing.platform, manifest: adapter.manifest, connection: settings,
  });
  if (unmet) {
    await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.ERROR, sync_error: unmet.message });
    return skipSync(listing, unmet.reason);
  }

  const isUpdate = !!listing.external_listing_id;

  // No inventory capability: refresh is a no-op, but first publish still runs.
  const capabilities = adapter.capabilities || {};
  if (isUpdate && capabilities.inventory === false) {
    logger.warn(`[marketplace.sync] listing ${listingId}: adapter "${listing.platform}" has no inventory capability — sync_listing is a no-op`);
    return skipSync(listing, "inventory_not_supported");
  }

  const variant = listing.variant
    ? await ProductVariant.findById(listing.variant).populate("attachments")
    : null;

  const resolved = resolveListing(listing, listing.product, variant);

  await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.PENDING });
  logger.info(`[marketplace.sync] syncing listing ${listingId} on ${listing.platform} (sku: ${resolved.sku})`);

  const startedAt = Date.now();
  try {
    // Inside the try so a lookup failure is recorded like any sync failure.
    await hydrateResolved([resolved], adapter, listing.tenant_id);
    const hooks = {
      // Persist early so a later failure's retry doesn't recreate the offer.
      onOfferCreated: (offerId) => listing.updateOne({ external_offer_id: offerId }),
      onQuantityPushed: (quantity) => recordQuantityPushed(listing, adapter, quantity, seq),
    };
    const ids = isUpdate
      ? await adapter.update(resolved, settings, hooks, seq)
      : await adapter.publish(resolved, settings, hooks, seq);

    // Adapter excluded this listing (e.g. Google skips untracked stock).
    if (ids?.skipped) {
      logger.info(`[marketplace.sync] listing ${listingId}: adapter skipped this sync (${ids.reason})`);
      // NOT_LISTED reused rather than a new status for one adapter's reason.
      await listing.updateOne({ sync_status: LISTING_SYNC_STATUS.NOT_LISTED, sync_error: null });
      // Connection is healthy; only this listing's data was ineligible.
      await circuitBreaker.recordSuccess(listing.tenant_id, listing.platform);
      await logSyncEvent({
        tenantId: listing.tenant_id,
        platform: listing.platform,
        jobType: isUpdate ? "update" : "publish",
        entityId: listing._id,
        status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
        errorCode: ids.reason,
        durationMs: Date.now() - startedAt,
      });
      return { skipped: true, reason: ids.reason };
    }

    await circuitBreaker.recordSuccess(listing.tenant_id, listing.platform);

    // From what was pushed; quantity is null for untracked stock (never OOS).
    const outOfStock = ids.quantity === 0;

    // priceLocked: eBay refused a revision during a sale; status, not error.
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
    await flagIfPrerequisiteError(listing.tenant_id, listing.platform, adapter.manifest, err);
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: isUpdate ? "update" : "publish",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.FAILURE,
      // Surfaces named adapter errors (e.g. CONDITION_UNVERIFIED) in the UI
      errorCode: err.code ?? null,
      errorMessage: err.message,
      errorStatus: err.status,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

// Builds adapter.end()'s context; settings load only if there's a SKU to end.
async function loadEndContext(listing, adapter) {
  const productId = listing.product?._id || listing.product;
  const [product, variant] = await Promise.all([
    productId ? Product.findById(productId).select("_id sku slug tenant_id").lean() : null,
    listing.variant ? ProductVariant.findById(listing.variant).select("_id sku").lean() : null,
  ]);
  const sku = product ? resolveSku(listing, product, variant) : listing.store_sku || null;
  const settings = product && sku ? await adapter.loadSettings(product.tenant_id) : null;
  return { product, variant, settings, sku };
}

async function endListing(listingId) {
  const listing = await MarketplaceListing.findById(listingId);

  if (!listing) return { error: "Listing not found" };

  if (!listing.external_listing_id && !listing.external_offer_id) {
    return { skipped: true, reason: "never_synced" };
  }

  const adapter = getAdapter(listing.platform);

  try {
    await adapter.end(listing, await loadEndContext(listing, adapter));
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

// Cursor-chunked batch push for feed channels; opts.listingIds limits scope.
async function syncBatch(platform, tenantId, opts = {}) {
  const adapter = getAdapter(platform);
  if (adapter.capabilities?.batch !== true || typeof adapter.publishBatch !== "function") {
    throw new Error(`[marketplace.sync] adapter "${platform}" does not support batch sync`);
  }

  const settings = typeof adapter.loadSettings === "function" ? await adapter.loadSettings(tenantId) : null;
  if (settings === null) {
    logger.warn(`[marketplace.sync] syncBatch: "${platform}" has no connection for tenant ${tenantId} — skipping`);
    return { skipped: true, reason: "not_connected" };
  }

  if (await circuitBreaker.isOpen(tenantId, platform)) {
    logger.warn(`[marketplace.sync] syncBatch: circuit open for ${platform}/${tenantId} — skipping until resumed`);
    return { skipped: true, reason: "circuit_open" };
  }

  const unmet = await ensurePrerequisites({ tenantId, platform, manifest: adapter.manifest, connection: settings });
  if (unmet) {
    logger.warn(`[marketplace.sync] syncBatch: ${platform}/${tenantId} prerequisite unmet (${unmet.reason}) — skipping`);
    return { skipped: true, reason: unmet.reason };
  }

  const chunkSize = opts.chunkSize ?? config.channels.batchChunkSize;
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  const query = { tenant_id: tenantId, platform, state: LISTING_STATE.ACTIVE };
  if (opts.listingIds && opts.listingIds.length) query._id = { $in: opts.listingIds };

  const cursor = MarketplaceListing.find(query)
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate("photo_overrides")
    .cursor();

  let chunk = [];
  const flush = async () => {
    if (!chunk.length) return;
    await processBatchChunk(adapter, settings, chunk, summary);
    chunk = [];
  };

  try {
    for (let listing = await cursor.next(); listing != null; listing = await cursor.next()) {
      chunk.push(listing);
      if (chunk.length >= chunkSize) await flush();
    }
    await flush();

    await circuitBreaker.recordSuccess(tenantId, platform);
    logger.info(
      `[marketplace.sync] syncBatch ${platform}/${tenantId} complete: processed=${summary.processed} ` +
        `succeeded=${summary.succeeded} failed=${summary.failed} skipped=${summary.skipped}`,
    );
    return { ok: true, ...summary };
  } catch (err) {
    // Only a whole-batch throw counts toward the breaker, not per-item errors.
    logger.error(`[marketplace.sync] syncBatch ${platform}/${tenantId} failed: ${err.message}`);
    await circuitBreaker.recordFailure(tenantId, platform, err);
    throw err;
  }
}

// Fences, publishes and records one chunk; item failures never throw.
async function processBatchChunk(adapter, settings, chunk, summary) {
  const candidates = [];
  for (const listing of chunk) {
    if (!listing.product) continue; // product deleted out from under a listing
    const seq = listing.push_seq ?? 0;
    const variant = listing.variant ? await ProductVariant.findById(listing.variant).populate("attachments") : null;
    const resolved = resolveListing(listing, listing.product, variant);
    candidates.push({ listing, resolved, seq });
  }
  if (!candidates.length) return;

  // Fresh fence re-check in one query; cursor reads may be long stale.
  const ids = candidates.map((c) => c.listing._id);
  const currentSeqs = await MarketplaceListing.find({ _id: { $in: ids } }).select("last_pushed_seq").lean();
  const lastPushedById = new Map(currentSeqs.map((d) => [String(d._id), d.last_pushed_seq ?? 0]));

  const toPush = [];
  for (const candidate of candidates) {
    const currentLastPushed = lastPushedById.get(String(candidate.listing._id)) ?? 0;
    if (candidate.seq < currentLastPushed) {
      summary.processed++;
      summary.skipped++;
      await logSyncEvent({
        tenantId: candidate.listing.tenant_id,
        platform: candidate.listing.platform,
        jobType: "sync_batch",
        entityId: candidate.listing._id,
        status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
        errorCode: "stale_seq",
      });
      continue;
    }
    toPush.push(candidate);
  }
  if (!toPush.length) return;

  const resolvedChunk = toPush.map((c) => c.resolved);
  try {
    await hydrateResolved(resolvedChunk, adapter, toPush[0].listing.tenant_id);
  } catch (err) {
    // Attach to each item so failures stay per item.
    for (const resolved of resolvedChunk) resolved.hydrationError = err;
  }
  const results = await adapter.publishBatch(resolvedChunk, settings);

  for (let i = 0; i < toPush.length; i++) {
    const { listing, seq } = toPush[i];
    const result = results[i];
    summary.processed++;

    if (result?.skipped) {
      summary.skipped++;
      await listing.updateOne({ $set: { sync_status: LISTING_SYNC_STATUS.NOT_LISTED, sync_error: null } });
      await logSyncEvent({
        tenantId: listing.tenant_id,
        platform: listing.platform,
        jobType: "sync_batch",
        entityId: listing._id,
        status: CHANNEL_SYNC_LOG_STATUS.SKIPPED,
        errorCode: result.reason,
      });
      continue;
    }

    if (!result?.ok) {
      summary.failed++;
      const errorMessage = result?.error || "Unknown batch item failure";
      await listing.updateOne({ $set: { sync_status: LISTING_SYNC_STATUS.ERROR, sync_error: errorMessage } });
      // No recordFailure: an item failure is bad data, not a bad connection.
      await logSyncEvent({
        tenantId: listing.tenant_id,
        platform: listing.platform,
        jobType: "sync_batch",
        entityId: listing._id,
        status: CHANNEL_SYNC_LOG_STATUS.FAILURE,
        errorMessage,
      });
      continue;
    }

    summary.succeeded++;
    const outOfStock = result.quantity === 0;
    // $max so a newer push landing since the re-check is never regressed.
    await listing.updateOne({
      $set: {
        external_listing_id: result.external_listing_id || listing.external_listing_id,
        external_offer_id: result.external_offer_id || listing.external_offer_id,
        sync_status: outOfStock ? LISTING_SYNC_STATUS.OUT_OF_STOCK : LISTING_SYNC_STATUS.SYNCED,
        state: LISTING_STATE.ACTIVE,
        synced_at: new Date(),
        sync_error: null,
      },
      $max: { last_pushed_seq: seq },
    });
    await logSyncEvent({
      tenantId: listing.tenant_id,
      platform: listing.platform,
      jobType: "sync_batch",
      entityId: listing._id,
      status: CHANNEL_SYNC_LOG_STATUS.SUCCESS,
    });
  }
}

/** Current push_seq (0 if unset), or null if the listing is gone. */
async function getListingPushSeq(listingId) {
  const listing = await MarketplaceListing.findById(listingId).select("push_seq").lean();
  return listing ? (listing.push_seq ?? 0) : null;
}

module.exports = { syncListing, endListing, getListingPushSeq, syncBatch };
