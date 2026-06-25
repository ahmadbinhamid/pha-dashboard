// src/workers/ebay.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { ebayQueue } = require("../queues/ebay.queue");
const { pollAndProcessOrders } = require("../services/ebay/ebay.orders.service");
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

ebayQueue.on("ready", () => {
  logger.info("[ebayQueue] ready");

  // Schedule order polling every 60 seconds — single repeatable job
  ebayQueue.add("poll_orders", {}, {
    repeat: { every: 60_000 },
    jobId: "poll_orders_repeat",
    removeOnComplete: true,
    removeOnFail: false,
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
