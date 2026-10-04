// src/workers/channel.worker.js
// Every adapter's sync queue plus eBay polling; may be limited to platforms.

require("dotenv").config();
const { createShutdown, onShutdownSignals } = require("../utils/gracefulShutdown");
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { logger } = require("../loaders/logging");
const config = require("../config");
const registry = require("../services/marketplace/registry");
const { registerAdapters } = require("../services/marketplace/registerAdapters");
const { getQueue, enqueueChannelJob } = require("../queues/channel.queue");
const marketplaceSync = require("../services/marketplace/sync.service");
const refreshService = require("../services/marketplace/refresh.service");

// eBay stays at 1: fencing alone can't stop two same-listing jobs racing.
const SYNC_LISTING_CONCURRENCY = { ebay: 1 };
const DEFAULT_CONCURRENCY = 2;

// Full-catalogue syncs are heavy; keep them low and apart from sync_listing.
const SYNC_BATCH_CONCURRENCY = { };
const DEFAULT_BATCH_CONCURRENCY = 1;

const activeQueues = [];

// A same-id add while a job is active is swallowed; re-check once it frees.
async function recoverMidFlightChange(platformKey, job, result) {
  // Only an applied sync ({ ok }) can have missed a mid-flight change.
  if (!result?.ok) return;

  const { listingId, seq } = job.data;
  // No seq means no fencing (e.g. a manual resync): nothing to compare.
  if (!listingId || seq == null) return;

  const currentPushSeq = await marketplaceSync.getListingPushSeq(listingId);
  if (currentPushSeq == null) return; // listing no longer exists

  // Strictly greater, so this only fires again on a newer stock change.
  if (currentPushSeq <= seq) return;

  logger.info(
    `[channelWorker:${platformKey}] mid-flight change recovered for listing ${listingId}: ` +
      `push_seq is now ${currentPushSeq} but job ${job.id} only applied seq ${seq} — re-enqueueing`,
  );
  // No delay: the drift is confirmed; the debounced id still prevents doubles.
  await enqueueChannelJob(platformKey, "sync_listing", { listingId, seq: currentPushSeq }, { delay: 0 });
}

function attachSyncListingProcessor(adapter) {
  const queue = getQueue(adapter.key);
  const concurrency = SYNC_LISTING_CONCURRENCY[adapter.key] ?? DEFAULT_CONCURRENCY;

  queue.process("sync_listing", concurrency, async (job) => {
    // The { listingId, seq } payload shape has never changed across deploys.
    const { listingId, seq } = job.data;
    logger.info(`[channelWorker:${adapter.key}] sync_listing listingId=${listingId} seq=${seq}`);
    const result = await marketplaceSync.syncListing(listingId, seq);
    if (result && result.error) throw new Error(result.error);
    return result;
  });

  queue.on("completed", (job, result) => {
    logger.info(`[channelWorker:${adapter.key}] completed job ${job.id} (${job.name})`);
    if (job.name !== "sync_listing") return;
    // Best-effort: a re-enqueue failure must not escape this listener.
    recoverMidFlightChange(adapter.key, job, result).catch((err) => {
      logger.error(`[channelWorker:${adapter.key}] mid-flight recovery check failed for job ${job.id}: ${err.message}`);
    });
  });
  // Failed jobs skip recovery; retries and the breaker own failures.
  queue.on("failed", (job, err) => logger.error(`[channelWorker:${adapter.key}] failed job ${job?.id} (${job?.name}): ${err?.message}`));

  activeQueues.push(queue);
  return queue;
}

// Only for adapters that support batch; one-shot, never debounced.
function attachSyncBatchProcessor(adapter, queue) {
  const concurrency = SYNC_BATCH_CONCURRENCY[adapter.key] ?? DEFAULT_BATCH_CONCURRENCY;

  queue.process("sync_batch", concurrency, async (job) => {
    // listingIds: a refresh of specific stale listings; absent means all.
    const { tenantId, listingIds } = job.data;
    logger.info(`[channelWorker:${adapter.key}] sync_batch tenantId=${tenantId}${listingIds ? ` (refresh, ${listingIds.length} listing(s))` : ""}`);
    return marketplaceSync.syncBatch(adapter.key, tenantId, listingIds ? { listingIds } : {});
  });
}

// Only for adapters with refreshIntervalDays (Google expires after 30d).
function attachRefreshStaleScheduler(adapter, queue) {
  queue.process("refresh_stale", 1, async () => {
    logger.info(`[channelWorker:${adapter.key}] refresh_stale sweep starting`);
    return refreshService.sweepStaleListings(adapter.key);
  });

  // Bull's Queue has no "ready" event; isReady() is the real API.
  queue.isReady().then(async () => {
    // Repeatables are keyed by interval too; clear old ones or two would run.
    const existing = await queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === "refresh_stale") {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`[channelWorker:${adapter.key}] removed stale repeatable schedule: ${job.key}`);
      }
    }

    queue.add(
      "refresh_stale",
      {},
      {
        repeat: { every: config.channels.refreshSweepIntervalHours * 60 * 60 * 1000 },
        jobId: "refresh_stale_repeat",
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  });
}

// Ported unchanged from the old workers/ebay.worker.js.
function attachEbayPolling(queue) {
  const { pollAndProcessOrders } = require("../services/ebay/ebay.orders.service");
  const { reconcileEbayInventory } = require("../services/ebay/ebay.inventory-sync.service");

  queue.process("poll_orders", 1, async () => {
    logger.info("[channelWorker:ebay] poll_orders starting");
    return pollAndProcessOrders();
  });

  // Pulls seller-side quantity edits from eBay back into local stock.
  queue.process("poll_inventory", 1, async () => {
    logger.info("[channelWorker:ebay] poll_inventory starting");
    return reconcileEbayInventory();
  });

  // Bull's Queue has no "ready" event; isReady() is the real API.
  queue.isReady().then(async () => {
    // Repeatables are keyed by interval too; clear old ones or two would run.
    const existing = await queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === "poll_orders" || job.name === "poll_inventory") {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`[channelWorker:ebay] removed stale repeatable schedule: ${job.key}`);
      }
    }

    // A fallback for webhooks eBay failed to deliver; real time is the webhook.
    queue.add(
      "poll_orders",
      {},
      {
        repeat: { every: 5 * 60_000 },
        jobId: "poll_orders_repeat",
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );

    // No webhook mirrors full inventory, so polling is the only drift check.
    queue.add(
      "poll_inventory",
      {},
      {
        repeat: { every: 15 * 60_000 },
        jobId: "poll_inventory_repeat",
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  });
}

async function startChannelWorker({ platforms } = {}) {
  await connectMongo();
  registerAdapters();

  const adapters = registry.getAll().filter((a) => !platforms || platforms.includes(a.key));
  if (!adapters.length) {
    logger.warn("[channelWorker] no adapters matched startChannelWorker's platform filter — nothing to process");
  }

  for (const adapter of adapters) {
    const queue = attachSyncListingProcessor(adapter);
    if (adapter.capabilities?.batch === true && typeof adapter.publishBatch === "function") {
      attachSyncBatchProcessor(adapter, queue);
    }
    if (adapter.refreshIntervalDays) {
      attachRefreshStaleScheduler(adapter, queue);
    }
    if (adapter.key === "ebay") attachEbayPolling(queue);
    queue.isReady().then(() => logger.info(`[channelWorker:${adapter.key}] ready`));
  }

  return activeQueues;
}

// Shared drain-then-exit; getQueues is read at signal time.
const shutdown = createShutdown({ name: "channelWorker", getQueues: () => activeQueues });

if (require.main === module) {
  startChannelWorker().catch((err) => {
    logger.error(`[channelWorker] failed to start: ${err.message}`);
    process.exit(1);
  });
  onShutdownSignals(shutdown);
}

module.exports = {
  startChannelWorker,
  shutdown,
  // Exported for tests only.
  attachSyncListingProcessor,
  attachSyncBatchProcessor,
  attachRefreshStaleScheduler,
  recoverMidFlightChange,
};
