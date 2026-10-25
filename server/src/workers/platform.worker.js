// src/workers/platform.worker.js
// Email, search and order sweeps in one process: all low-volume.

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any populate()/query
const { logger } = require("../loaders/logging");
const { installGracefulShutdown } = require("../utils/gracefulShutdown");
const config = require("../config");

const { emailQueue } = require("../queues/email.queue");
const { render } = require("../services/email/templateLoader");
const { sendEmail } = require("../services/email/mailer");
const inventoryDigestService = require("../services/inventory-digest.service");

const { searchQueue } = require("../queues/search.queue");
const { ensureProductsCollection } = require("../services/search/product.search.schema");
const { indexProduct, deleteProductFromIndex } = require("../services/search/product.search.service");
const { findProductByIdForIndexing } = require("../services/product.service");

const { orderQueue } = require("../queues/order.queue");
const { sweepOverdueInvoices } = require("../services/order-overdue.service");

connectMongo().catch((err) => {
  logger.error(`[platformWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

ensureProductsCollection().catch((err) => {
  logger.error(`[platformWorker] failed to ensure Typesense collection: ${err.message}`);
});

// ── email ──

// NOTE: use the *named* processor: 'send'
emailQueue.process("send", 5, async (job) => {
  const { to, subject, template, variables, from, fromName, tenantId, text, attachments } = job.data;

  const html = render(template, variables);
  const ok = await sendEmail({ from, fromName, tenantId, to, subject, html, text, attachments });
  if (!ok) throw new Error("Failed to send email");

  return true;
});

emailQueue.isReady().then(() => logger.info("[emailQueue] ready"));
emailQueue.on("completed", (job) => logger.info(`[emailQueue] completed ${job.id}`));
emailQueue.on("failed", (job, err) => logger.error(`[emailQueue] failed ${job?.id}: ${err?.message}`));

// ── low stock digest: its own job name on emailQueue ──

emailQueue.process("low_stock_digest_sweep", 1, async () => {
  logger.info("[emailQueue] low_stock_digest_sweep starting");
  return inventoryDigestService.sweepLowStockDigests();
});

/** Schedules one repeatable sweep, dropping schedules from older intervals. */
async function scheduleRepeatable(queue, name, everyMinutes) {
  // Repeatables are keyed by interval too; clear old ones or two would run.
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name !== name) continue;
    await queue.removeRepeatableByKey(job.key);
    logger.info(`[${queue.name}Queue] removed stale ${name} schedule: ${job.key}`);
  }

  await queue.add(
    name,
    {},
    {
      repeat: { every: everyMinutes * 60 * 1000 },
      jobId: `${name}_repeat`,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
    },
  );
}

emailQueue.isReady().then(() =>
  scheduleRepeatable(emailQueue, "low_stock_digest_sweep", config.inventory.digestSweepIntervalMinutes),
);

// ── search ──

// Re-fetches at process time so a long-queued job indexes the latest state.
searchQueue.process("index_product", 4, async (job) => {
  const { productId } = job.data;
  const product = await findProductByIdForIndexing(productId);
  if (!product) {
    await deleteProductFromIndex(productId);
    return;
  }
  await indexProduct(product);
});

searchQueue.process("delete_product", 4, async (job) => {
  const { productId } = job.data;
  await deleteProductFromIndex(productId);
});

searchQueue.isReady().then(() => logger.info("[searchQueue] ready"));
searchQueue.on("completed", (job) => logger.info(`[searchQueue] completed job ${job.id} (${job.name})`));
searchQueue.on("failed", (job, err) => logger.error(`[searchQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`));

// ── orders ──

orderQueue.process("overdue_invoice_sweep", 1, async () => {
  logger.info("[orderQueue] overdue_invoice_sweep starting");
  return sweepOverdueInvoices();
});

orderQueue.isReady().then(() =>
  scheduleRepeatable(orderQueue, "overdue_invoice_sweep", config.orders.overdueSweepIntervalMinutes),
);
orderQueue.on("completed", (job) => logger.info(`[orderQueue] completed job ${job.id} (${job.name})`));
orderQueue.on("failed", (job, err) => logger.error(`[orderQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`));

installGracefulShutdown({ name: "platformWorker", getQueues: () => [emailQueue, searchQueue, orderQueue] });
