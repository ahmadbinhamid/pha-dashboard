// src/workers/email.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate() calls
const { emailQueue } = require("../queues/email.queue");
const { processEmailJob } = require("../services/email/mailer");
const { logger } = require("../loaders/logging");
const { installGracefulShutdown } = require("../utils/gracefulShutdown");

connectMongo().catch((err) => {
  logger.error(`[emailWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

// NOTE: named processor "send"; enqueueEmailJob adds jobs under that name.
emailQueue.process("send", 5, processEmailJob);

// Bull's Queue never emits a "ready" event; isReady() is the real API for this.
emailQueue.isReady().then(() => logger.info("[emailQueue] ready"));
emailQueue.on("completed", (job) =>
  logger.info(`[emailQueue] completed ${job.id}`)
);
emailQueue.on("failed", (job, err) =>
  logger.error(`[emailQueue] failed ${job?.id}: ${err?.message}`, {
    template: job?.data?.template,
    attemptsMade: job?.attemptsMade,
  }),
);

installGracefulShutdown({ name: "emailWorker", getQueues: () => [emailQueue] });
