// src/workers/search.worker.js

require("dotenv").config();
const { connectMongo } = require("../loaders/mongoose");
require("../models/index"); // register all schemas before any query
const { searchQueue } = require("../queues/search.queue");
const { ensureProductsCollection } = require("../services/search/product.search.schema");
const { indexProduct, deleteProductFromIndex } = require("../services/search/product.search.service");
const Product = require("../models/Product");
const { logger } = require("../loaders/logging");

connectMongo().catch((err) => {
  logger.error(`[searchWorker] MongoDB connection failed: ${err.message}`);
  process.exit(1);
});

ensureProductsCollection().catch((err) => {
  logger.error(`[searchWorker] failed to ensure Typesense collection: ${err.message}`);
});

// Re-fetches the product at process time (rather than trusting the payload)
// so a job that sat in the queue for a while still indexes the latest state.
searchQueue.process("index_product", 4, async (job) => {
  const { productId } = job.data;
  // findById already excludes soft-deleted docs (softDelete.plugin's default
  // query filter), so a null here means "deleted since this job was
  // enqueued" — clean up the index instead of throwing.
  const product = await Product.findById(productId);
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

searchQueue.isReady().then(() => {
  logger.info("[searchQueue] ready");
});

searchQueue.on("completed", (job) =>
  logger.info(`[searchQueue] completed job ${job.id} (${job.name})`),
);
searchQueue.on("failed", (job, err) =>
  logger.error(`[searchQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`),
);
