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

    const alreadyDone = await EbayProcessedOrder.exists({ orderId });
    if (alreadyDone) continue;

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

    await EbayProcessedOrder.create({ orderId, lineItems: adjustments });
    processed++;
  }

  logger.info(`[ebay.orders] Poll complete — ${processed} new / ${orders.length} total`);
  return { processed, total: orders.length };
}

module.exports = { pollAndProcessOrders };
