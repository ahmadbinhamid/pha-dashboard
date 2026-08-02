// services/ebay/ebay.orders.service.js
// Polls eBay Fulfillment API for new orders, imports them into the Order
// collection, and deducts stock. Multi-tenant: runs once per eBay-enabled
// tenant, each with their own credentials — one tenant's poll failing never
// blocks another's.

const EbayProcessedOrder = require("../../models/EbayProcessedOrder");
const ebayApi = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const { createOrderFromEbayOrder } = require("../order.service");
const { getConfiguredTenants } = require("./ebay.tenant");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

// Order import has its own idempotency (Order.external_order_id) independent
// of the stock-deduction guard below, so it runs for every polled order —
// including ones whose stock was already deducted in an earlier run, e.g.
// orders that came in before this import feature existed.
async function importOrder(order, tenant) {
  try {
    await createOrderFromEbayOrder(order, tenant);
  } catch (err) {
    logger.error(`[ebay.orders] tenant ${tenant._id}: failed to import order ${order.orderId}: ${err.message}`);
  }
}

async function pollOrdersForTenant(tenant, settings) {
  const data = await ebayApi.getOrders(settings);
  const orders = data.orders || [];

  if (!orders.length) {
    return { processed: 0, total: 0 };
  }

  let processed = 0;

  for (const order of orders) {
    const orderId = order.orderId;
    if (!orderId) continue;

    await importOrder(order, tenant);

    // Atomic insert — if the record already exists (duplicate key) we skip.
    // This is safe against a concurrent webhook deduction racing the poller.
    // eBay order IDs are globally unique platform-wide, so this ledger needs
    // no tenant scoping to stay correct.
    let inserted = false;
    try {
      await EbayProcessedOrder.create({
        platform: MARKETPLACE_PLATFORM.EBAY,
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
        { platform: MARKETPLACE_PLATFORM.EBAY, orderId, action: "deduction" },
        { $set: { lineItems: adjustments } },
      );
    }

    processed++;
  }

  return { processed, total: orders.length };
}

async function pollAndProcessOrders() {
  const configured = await getConfiguredTenants();
  if (!configured.length) {
    logger.info("[ebay.orders] No tenants have eBay configured — skipping poll");
    return { processed: 0, total: 0, tenants: 0 };
  }

  let processed = 0;
  let total = 0;

  for (const { tenant, settings } of configured) {
    try {
      const result = await pollOrdersForTenant(tenant, settings);
      processed += result.processed;
      total += result.total;
    } catch (err) {
      // One tenant's eBay outage/auth failure must never block the rest.
      logger.error(`[ebay.orders] tenant ${tenant._id} poll failed: ${err.message}`);
    }
  }

  logger.info(`[ebay.orders] Poll complete — ${processed} new / ${total} total across ${configured.length} tenant(s)`);
  return { processed, total, tenants: configured.length };
}

module.exports = { pollAndProcessOrders };
