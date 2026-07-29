// src/workers/stripe.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { stripeQueue } = require("../queues/stripe.queue");
const { cleanupAbandonedOrders } = require("../services/stripe/stripe.cleanup.service");
const { reconcileStuckRefunds } = require("../services/refund.reconciliation.service");
const { logger } = require("../loaders/logging");

connectMongo().catch((err) => {
  logger.error(`[stripeWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

stripeQueue.process("cleanup_abandoned_orders", 1, async () => {
  logger.info("[stripeQueue] cleanup_abandoned_orders starting");
  return cleanupAbandonedOrders();
});

stripeQueue.process("reconcile_stuck_refunds", 1, async () => {
  logger.info("[stripeQueue] reconcile_stuck_refunds starting");
  return reconcileStuckRefunds();
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

  // Stuck-refund reconciliation (corrections round) — every 15 minutes.
  // Shorter than RESERVATION_STALE_AFTER_MS (1h, the age a refund has to
  // reach before this job's own query even considers it stuck) so a refund
  // that goes stuck gets picked up on close to the first sweep after
  // crossing that threshold, not left for up to another hour on top.
  stripeQueue.add(
    "reconcile_stuck_refunds",
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: "reconcile_stuck_refunds_repeat",
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
