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
const { getQueue, enqueueChannelJob } = require("../queues/channel.queue");
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

// Debounced sync_listing jobs are keyed by listing id (see
// channel.queue.js's jobId `sync:<platform>:<listingId>`) — while that job
// is ACTIVE (already picked up, mid-flight), Bull's add() with the same
// jobId returns the existing (active) job rather than creating a new one:
// a stock change's fan-out call landing in that window is silently
// swallowed. Concretely:
//   t=0  job J starts syncing listing L, resolves quantity 5
//   t=1  stock changes to 3 -> fan-out bumps push_seq -> enqueues
//        sync:ebay:L -> J is ACTIVE under that id -> Bull returns the
//        existing job, the add is a no-op
//   t=3  J completes, pushes 5 to eBay, removeOnComplete frees the id ->
//        nothing is queued; eBay shows 5, local stock is 3, no error logged
//
// Fixed here (the "completed" handler), not inside syncListing or
// enqueueChannelJobDirect, because the jobId slot is only free again once
// removeOnComplete has actually run — re-enqueueing any earlier would just
// be swallowed the same way. Verified for bull@4.16.5 (this repo's pinned
// version — see package.json): Queue#processJob awaits
// job.moveToCompleted() (the call that performs the Redis-side removal)
// BEFORE emitting "completed" — see node_modules/bull/lib/queue.js — so by
// the time this handler runs, the jobId is guaranteed free and a
// re-enqueue here creates a genuinely new job rather than being swallowed.
//
// Applies to every channel (keyed generically off push_seq/job.data, no
// eBay-specific logic) — not just eBay.
async function recoverMidFlightChange(platformKey, job, result) {
  // Only a job that actually applied a sync (not one skipped/dropped —
  // stale_seq, not_connected, circuit_open, inventory_not_supported all
  // return { skipped: true }, never { ok: true } — see sync.service.js)
  // can have left the listing mid-flight in the first place; whatever job
  // DID apply the current value already ran this same check itself.
  if (!result?.ok) return;

  const { listingId, seq } = job.data;
  // seq is null for a caller that doesn't participate in fencing (e.g. an
  // explicit manual resync with no stock change behind it) — nothing to
  // compare push_seq against.
  if (!listingId || seq == null) return;

  const currentPushSeq = await marketplaceSync.getListingPushSeq(listingId);
  if (currentPushSeq == null) return; // listing no longer exists

  // Strictly greater than what THIS job applied — an equal push_seq means
  // nothing has changed since, so there's nothing to recover. This is what
  // keeps this from looping: it only ever fires again in response to a NEW
  // real stock change bumping push_seq further, never on its own.
  if (currentPushSeq <= seq) return;

  logger.info(
    `[channelWorker:${platformKey}] mid-flight change recovered for listing ${listingId}: ` +
      `push_seq is now ${currentPushSeq} but job ${job.id} only applied seq ${seq} — re-enqueueing`,
  );
  // delay: 0 — this is already-confirmed drift (push_seq has definitely
  // moved past what was applied), not a fresh input worth debouncing
  // behind the normal window; every second spent waiting is a second eBay
  // keeps showing a quantity we already know is wrong. Still goes through
  // the normal debounced jobId (not bypassDebounce), so it can't create a
  // second concurrent job for this listing if an unrelated fan-out call
  // lands at the same moment — it either coalesces with that job or (if
  // this wins the race) is itself subject to the same recovery check.
  await enqueueChannelJob(platformKey, "sync_listing", { listingId, seq: currentPushSeq }, { delay: 0 });
}

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

  queue.on("completed", (job, result) => {
    logger.info(`[channelWorker:${adapter.key}] completed job ${job.id} (${job.name})`);
    if (job.name !== "sync_listing") return;
    // Never let a re-enqueue failure surface as an unhandled rejection out
    // of this event listener — log and move on, same as any other
    // best-effort recovery path in this codebase.
    recoverMidFlightChange(adapter.key, job, result).catch((err) => {
      logger.error(`[channelWorker:${adapter.key}] mid-flight recovery check failed for job ${job.id}: ${err.message}`);
    });
  });
  // A failed job (retries exhausted) deliberately does NOT run the
  // mid-flight recovery check — a job that never successfully applied
  // anything has nothing to have left "mid-flight" from its own
  // perspective, and retries/the circuit breaker (see sync.service.js,
  // circuitBreaker.js) already own recovering from failures.
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

module.exports = {
  startChannelWorker,
  shutdown,
  // Exported for tests (channel.worker.midflight.test.js) — not part of
  // the module's own operational surface.
  attachSyncListingProcessor,
  recoverMidFlightChange,
};
