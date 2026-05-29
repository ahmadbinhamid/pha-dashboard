// src/workers/ebay.worker.js

require("dotenv").config();
const { ebayQueue } = require("../queues/ebay.queue");
const ebayService = require("../services/ebay/ebay.service");
const { logger } = require("../loaders/logging");

ebayQueue.process("sync_product", 2, async (job) => {
  const { product, variants } = job.data;
  logger.info(
    `[ebayQueue] sync_product for product ${product?._id || product?.id}`,
  );
  const result = await ebayService.syncProduct(product, variants || []);
  if (result.error) throw new Error(result.error);
  return result;
});

ebayQueue.process("update_inventory", 5, async (job) => {
  const { sku, quantity } = job.data;
  logger.info(`[ebayQueue] update_inventory sku=${sku} qty=${quantity}`);
  const result = await ebayService.updateInventoryQuantity(sku, quantity);
  if (result.error) throw new Error(result.error);
  return result;
});

ebayQueue.process("delete_product", 2, async (job) => {
  const { sku } = job.data;
  logger.info(`[ebayQueue] delete_product sku=${sku}`);
  const result = await ebayService.deleteProduct(sku);
  if (result.error) throw new Error(result.error);
  return result;
});

ebayQueue.on("ready", () => logger.info("[ebayQueue] ready"));
ebayQueue.on("completed", (job) =>
  logger.info(`[ebayQueue] completed job ${job.id} (${job.name})`),
);
ebayQueue.on("failed", (job, err) =>
  logger.error(
    `[ebayQueue] failed job ${job?.id} (${job?.name}): ${err?.message}`,
  ),
);
