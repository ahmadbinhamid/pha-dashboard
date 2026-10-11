// services/marketplace/default-brand.service.js
// Re-pushes Meta/Google listings whose brand changed, in chunked batches.

const { logger } = require("../../loaders/logging");
const Product = require("../../models/Product");
const MarketplaceListing = require("../../models/MarketplaceListing");
const config = require("../../config");
const registry = require("./registry");
const channelQueue = require("../../queues/channel.queue");
const { LISTING_STATE } = require("../../constants/marketplace.constants");
const { CHANNEL_JOB } = require("../../constants/channel.constants");

// Products a store default applies to: no brand of their own.
const BRANDLESS = { $or: [{ brand: null }, { brand: "" }] };

/** Platforms that read the store default and can take a sync_batch. */
function defaultBrandPlatforms() {
  return registry
    .getAll()
    .filter((a) => a.needs?.defaultBrand && a.capabilities?.batch === true && typeof a.publishBatch === "function")
    .map((a) => a.key);
}

// One query per product chunk; returns listing ids grouped by platform.
async function listingIdsFor(tenantId, platforms, productIds) {
  const rows = await MarketplaceListing.find({
    tenant_id: tenantId,
    platform: { $in: platforms },
    state: LISTING_STATE.ACTIVE,
    product: { $in: productIds },
  })
    .select("_id platform")
    .lean();
  const byPlatform = new Map();
  for (const row of rows) byPlatform.set(row.platform, [...(byPlatform.get(row.platform) ?? []), String(row._id)]);
  return byPlatform;
}

/** Queues products' Meta/Google listings as sync_batch jobs of chunkSize. */
function createBrandResync(tenantId) {
  const platforms = defaultBrandPlatforms();
  const chunkSize = config.channels.batchChunkSize;
  const summary = { listings: 0, jobs: 0 };
  const pending = new Map(platforms.map((p) => [p, []]));

  const flush = async (platform, force = false) => {
    const ids = pending.get(platform);
    while (ids.length >= chunkSize || (force && ids.length)) {
      const listingIds = ids.splice(0, chunkSize);
      // NOTE: sync_batch never matches the sync_listing debounce jobId.
      await channelQueue.enqueueChannelJob(platform, CHANNEL_JOB.SYNC_BATCH, { tenantId: String(tenantId), listingIds });
      summary.jobs++;
    }
  };

  const addProducts = async (productIds) => {
    if (!platforms.length || !productIds.length) return;
    for (const [platform, ids] of await listingIdsFor(tenantId, platforms, productIds)) {
      pending.get(platform).push(...ids);
      summary.listings += ids.length;
      await flush(platform);
    }
  };

  const finish = async () => {
    for (const platform of platforms) await flush(platform, true);
    return summary;
  };

  return { addProducts, finish, chunkSize, enabled: platforms.length > 0 };
}

/** Queues chunked sync_batch jobs for brandless listings; returns counts. */
async function resyncBrandlessListings(tenantId) {
  const resync = createBrandResync(tenantId);
  if (!resync.enabled) return resync.finish();

  const cursor = Product.find({ tenant_id: tenantId, ...BRANDLESS }).select("_id").lean().cursor({ batchSize: resync.chunkSize });
  let productIds = [];
  for (let product = await cursor.next(); product != null; product = await cursor.next()) {
    productIds.push(product._id);
    if (productIds.length < resync.chunkSize) continue;
    await resync.addProducts(productIds);
    productIds = [];
  }
  await resync.addProducts(productIds);
  const summary = await resync.finish();

  logger.info(`[default-brand] tenant ${tenantId}: ${summary.listings} brandless listing(s) queued in ${summary.jobs} sync_batch job(s)`);
  return summary;
}

module.exports = { resyncBrandlessListings, defaultBrandPlatforms, createBrandResync };
