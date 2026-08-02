// src/workers/ebay.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { ebayQueue } = require("../queues/ebay.queue");
const { pollAndProcessOrders } = require("../services/ebay/ebay.orders.service");
const { reconcileEbayInventory } = require("../services/ebay/ebay.inventory-sync.service");
const { logger } = require("../loaders/logging");

// Register marketplace adapters
const registry = require("../services/marketplace/registry");
const ebayAdapter = require("../services/marketplace/adapters/ebay.adapter");
registry.register(ebayAdapter);

const marketplaceSync = require("../services/marketplace/sync.service");

connectMongo().catch((err) => {
  logger.error(`[ebayWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

// Marketplace-listing sync — runs through the adapter dispatcher
ebayQueue.process("sync_listing", 2, async (job) => {
  const { listingId } = job.data;
  logger.info(`[ebayQueue] sync_listing listingId=${listingId}`);
  const result = await marketplaceSync.syncListing(listingId);
  if (result && result.error) throw new Error(result.error);
  return result;
});

ebayQueue.process("poll_orders", 1, async () => {
  logger.info("[ebayQueue] poll_orders starting");
  return pollAndProcessOrders();
});

// Reconciles eBay-side quantity edits (e.g. a seller manually changing
// "Available quantity" in Seller Hub) back into local stock — see
// ebay.inventory-sync.service.js for the diff/apply logic.
ebayQueue.process("poll_inventory", 1, async () => {
  logger.info("[ebayQueue] poll_inventory starting");
  return reconcileEbayInventory();
});

// Retry target for eBay quantity pushes that failed inline from
// order-stock-sync.service.js (Stripe payment success / refund restock).
// Goes through the adapter (not updateInventoryQuantity directly) so a
// retried push also updates the inventory-sync baseline, same as an
// inline-successful push would.
ebayQueue.process("push_quantity", 2, async (job) => {
  const { sku, quantity } = job.data;
  logger.info(`[ebayQueue] push_quantity sku=${sku} quantity=${quantity}`);
  await ebayAdapter.pushInventory(sku, quantity);
});

// Bull's Queue never emits a "ready" event (only the underlying redis client
// does, internally) — isReady() is the real API for this.
ebayQueue.isReady().then(async () => {
  logger.info("[ebayQueue] ready");

  // Bull keys a repeatable job by its interval, not just its jobId — changing
  // `every` registers a second schedule in Redis alongside the old one rather
  // than replacing it. Clear any stale poll_orders/poll_inventory schedules
  // (e.g. the old 60s/5min intervals) before registering the current ones.
  const existing = await ebayQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === "poll_orders" || job.name === "poll_inventory") {
      await ebayQueue.removeRepeatableByKey(job.key);
      logger.info(`[ebayQueue] removed stale repeatable schedule: ${job.key}`);
    }
  }

  // Schedule order polling every 5 minutes — single repeatable job.
  // ebay.webhook.service.js already handles ORDER.LINE_ITEMS_CREATED/UPDATED
  // in real time, so this is purely a reconciliation fallback for webhook
  // deliveries eBay failed to make (not guaranteed 100%) — 60s was overkill
  // once the webhook covers the time-critical path.
  ebayQueue.add("poll_orders", {}, {
    repeat: { every: 5 * 60_000 },
    jobId: "poll_orders_repeat",
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  });

  // Schedule inventory reconciliation every 15 minutes — single repeatable
  // job. No webhook topic mirrors full inventory state (only discrete change
  // events), so this stays the only way to catch eBay-side drift (e.g. a
  // seller manually editing "Available quantity" in Seller Hub). Kept more
  // frequent than order polling since there's no real-time fallback for it.
  ebayQueue.add("poll_inventory", {}, {
    repeat: { every: 15 * 60_000 },
    jobId: "poll_inventory_repeat",
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  });
});

ebayQueue.on("completed", (job) =>
  logger.info(`[ebayQueue] completed job ${job.id} (${job.name})`),
);
ebayQueue.on("failed", (job, err) =>
  logger.error(
    `[ebayQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`,
  ),
);
