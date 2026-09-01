// src/workers/channel.worker.js
//
// Consolidated worker: registers every marketplace adapter, then attaches a
// sync_listing processor for each one's queue, at per-platform concurrency
// (eBay stays at its existing concurrency — see SYNC_LISTING_CONCURRENCY),
// plus eBay's own order/inventory polling — not part of the generic adapter
// contract (no other platform has an equivalent yet), so it's wired
// separately rather than through the generic per-platform loop below. See
// server/docs/channel-architecture.md.
//
// Can run standalone (every registered platform — the default when this
// file is run directly) or restricted to a subset via startChannelWorker's
// `platforms` option — see workers/ebay.worker.js, which delegates here
// restricted to just "ebay" so the OLD docker-compose (worker-ebay: node
// src/workers/ebay.worker.js) keeps booting correctly if deployed before
// the compose change (worker-ebay -> worker-channels) lands.

require("dotenv").config();
const mongoose = require("mongoose");
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { logger } = require("../loaders/logging");
const registry = require("../services/marketplace/registry");
const { registerAdapters } = require("../services/marketplace/registerAdapters");
const { getQueue } = require("../queues/channel.queue");
const marketplaceSync = require("../services/marketplace/sync.service");

// eBay's sync_listing concurrency has been 1 since the seq-fencing
// migration — two jobs for the SAME listing racing each other could still
// pass the "is this stale" check before either's write lands even with the
// fence (see ebay.adapter.js's module header comment) — unchanged here. Any
// platform not listed defaults to 2, a reasonable starting point for a
// brand-new adapter with no established throughput characteristics yet.
const SYNC_LISTING_CONCURRENCY = { ebay: 1 };
const DEFAULT_CONCURRENCY = 2;

const activeQueues = [];

function attachSyncListingProcessor(adapter) {
  const queue = getQueue(adapter.key);
  const concurrency = SYNC_LISTING_CONCURRENCY[adapter.key] ?? DEFAULT_CONCURRENCY;

  queue.process("sync_listing", concurrency, async (job) => {
    // Old-shape payload ({ listingId, seq }) from a job enqueued by the
    // previous deploy is still processed correctly — this shape has never
    // changed, only where enqueueChannelJob's debounce/jobId logic lives.
    const { listingId, seq } = job.data;
    logger.info(`[channelWorker:${adapter.key}] sync_listing listingId=${listingId} seq=${seq}`);
    const result = await marketplaceSync.syncListing(listingId, seq);
    if (result && result.error) throw new Error(result.error);
    return result;
  });

  queue.on("completed", (job) => logger.info(`[channelWorker:${adapter.key}] completed job ${job.id} (${job.name})`));
  queue.on("failed", (job, err) => logger.error(`[channelWorker:${adapter.key}] failed job ${job?.id} (${job?.name}): ${err?.message}`));

  activeQueues.push(queue);
  return queue;
}

// Ported unchanged from the old workers/ebay.worker.js.
function attachEbayPolling(queue) {
  const { pollAndProcessOrders } = require("../services/ebay/ebay.orders.service");
  const { reconcileEbayInventory } = require("../services/ebay/ebay.inventory-sync.service");

  queue.process("poll_orders", 1, async () => {
    logger.info("[channelWorker:ebay] poll_orders starting");
    return pollAndProcessOrders();
  });

  // Reconciles eBay-side quantity edits (e.g. a seller manually changing
  // "Available quantity" in Seller Hub) back into local stock — see
  // ebay.inventory-sync.service.js for the diff/apply logic.
  queue.process("poll_inventory", 1, async () => {
    logger.info("[channelWorker:ebay] poll_inventory starting");
    return reconcileEbayInventory();
  });

  // Bull's Queue never emits a "ready" event (only the underlying redis
  // client does, internally) — isReady() is the real API for this.
  queue.isReady().then(async () => {
    // Bull keys a repeatable job by its interval, not just its jobId —
    // changing `every` registers a second schedule in Redis alongside the
    // old one rather than replacing it. Clear any stale poll_orders/
    // poll_inventory schedules before registering the current ones.
    const existing = await queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === "poll_orders" || job.name === "poll_inventory") {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`[channelWorker:ebay] removed stale repeatable schedule: ${job.key}`);
      }
    }

    // Order polling every 5 minutes — ebay.webhook.service.js already
    // handles ORDER.LINE_ITEMS_CREATED/UPDATED in real time, so this is
    // purely a reconciliation fallback for webhook deliveries eBay failed
    // to make (not guaranteed 100%).
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

    // Inventory reconciliation every 15 minutes — no webhook topic mirrors
    // full inventory state (only discrete change events), so this stays the
    // only way to catch eBay-side drift.
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
    if (adapter.key === "ebay") attachEbayPolling(queue);
    queue.isReady().then(() => logger.info(`[channelWorker:${adapter.key}] ready`));
  }

  return activeQueues;
}

let shuttingDown = false;

// Bull's Queue#close() already stops the queue from picking up new jobs and
// waits for active ones to finish before resolving — this just sequences
// that against closing Mongo/Redis afterward and exiting.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[channelWorker] ${signal} received — stopping new jobs, waiting for in-flight jobs to finish`);
  try {
    await Promise.all(activeQueues.map((q) => q.close()));
    await mongoose.connection.close();
    logger.info("[channelWorker] shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error(`[channelWorker] error during shutdown: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startChannelWorker().catch((err) => {
    logger.error(`[channelWorker] failed to start: ${err.message}`);
    process.exit(1);
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = { startChannelWorker, shutdown };
