// src/workers/stripe.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { stripeQueue } = require("../queues/stripe.queue");
const { cleanupAbandonedOrders } = require("../services/stripe/stripe.cleanup.service");
const { logger } = require("../loaders/logging");

connectMongo().catch((err) => {
  logger.error(`[stripeWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

stripeQueue.process("cleanup_abandoned_orders", 1, async () => {
  logger.info("[stripeQueue] cleanup_abandoned_orders starting");
  return cleanupAbandonedOrders();
});

// Bull's Queue never emits a "ready" event (only the underlying redis client
// does, internally) — isReady() is the real API for this.
stripeQueue.isReady().then(() => {
  logger.info("[stripeQueue] ready");

  // Schedule abandoned-order cleanup hourly — single repeatable job.
  stripeQueue.add(
    "cleanup_abandoned_orders",
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "cleanup_abandoned_orders_repeat",
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
});

stripeQueue.on("completed", (job) =>
  logger.info(`[stripeQueue] completed job ${job.id} (${job.name})`),
);
stripeQueue.on("failed", (job, err) =>
  logger.error(`[stripeQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`),
);
