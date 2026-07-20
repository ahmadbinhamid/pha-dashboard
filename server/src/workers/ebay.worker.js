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
ebayQueue.isReady().then(() => {
  logger.info("[ebayQueue] ready");

  // Schedule order polling every 60 seconds — single repeatable job.
  // attempts/backoff cover a transient eBay-side error (e.g. a momentary 503)
  // with a quick retry instead of waiting a full 60s for the next scheduled tick.
  ebayQueue.add("poll_orders", {}, {
    repeat: { every: 60_000 },
    jobId: "poll_orders_repeat",
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  });

  // Schedule inventory reconciliation every 5 minutes — single repeatable job.
  // Less frequent than order polling since it fetches every active listing's
  // quantity from eBay rather than reacting to a single event.
  ebayQueue.add("poll_inventory", {}, {
    repeat: { every: 5 * 60_000 },
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
