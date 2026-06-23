// services/ebay/ebay.orders.service.js
// Polls eBay Fulfillment API for new orders and deducts stock

const EbayProcessedOrder = require("../../models/EbayProcessedOrder");
const { getOrders } = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const { logger } = require("../../loaders/logging");

async function pollAndProcessOrders() {
  const data = await getOrders();
  const orders = data.orders || [];

  if (!orders.length) {
    logger.info("[ebay.orders] No unfulfilled orders found");
    return { processed: 0, total: 0 };
  }

  let processed = 0;

  for (const order of orders) {
    const orderId = order.orderId;
    if (!orderId) continue;

    // Atomic insert — if the record already exists (duplicate key) we skip.
    // This is safe against a concurrent webhook deduction racing the poller.
    let inserted = false;
    try {
      await EbayProcessedOrder.create({
        orderId,
        action: "deduction",
        source: "poller",
        lineItems: [],
      });
      inserted = true;
    } catch (err) {
      if (err.code === 11000) {
        logger.info(`[ebay.orders] Order ${orderId} already processed — skipping`);
        continue;
      }
      throw err;
    }

    const lineItems = order.lineItems || [];
    const adjustments = [];

    for (const item of lineItems) {
      const sku = item.sku;
      const qty = Number(item.quantity) || 1;
      if (!sku) {
        logger.warn(`[ebay.orders] Line item in order ${orderId} has no SKU — skipping`);
        continue;
      }

      try {
        await adjustStockBySku(sku, -qty);
        adjustments.push({ sku, quantity: qty });
        logger.info(`[ebay.orders] Deducted ${qty} × ${sku} for order ${orderId}`);
      } catch (err) {
        logger.error(`[ebay.orders] Stock deduction failed for SKU ${sku}: ${err.message}`);
      }
    }

    // Backfill lineItems now that we have the full adjustment list
    if (inserted) {
      await EbayProcessedOrder.updateOne(
        { orderId, action: "deduction" },
        { $set: { lineItems: adjustments } },
      );
    }

    processed++;
  }

  logger.info(`[ebay.orders] Poll complete — ${processed} new / ${orders.length} total`);
  return { processed, total: orders.length };
}

module.exports = { pollAndProcessOrders };
