// services/ebay/ebay.orders.service.js
// Polls eBay Fulfillment API for new orders, imports them, and deducts stock; one tenant's failure never blocks another's.

const ChannelProcessedEvent = require("../../models/ChannelProcessedEvent");
const ebayApi = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const { createOrderFromEbayOrder } = require("../order.service");
const { getConfiguredTenants } = require("./ebay.tenant");
const { markConnectionError } = require("./ebay.settings.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Runs for every polled order — has its own idempotency (Order.external_order_id) independent of the stock guard below.
async function importOrder(order, tenant, settings) {
  try {
    await createOrderFromEbayOrder(order, tenant, settings);
  } catch (err) {
    logger.error(`[ebay.orders] tenant ${tenant._id}: failed to import order ${order.orderId}: ${err.message}`);
  }
}

async function pollOrdersForTenant(tenant, settings) {
  const orders = await ebayApi.getAllOpenOrders(settings);

  if (!orders.length) {
    return { processed: 0, total: 0 };
  }

  let processed = 0;

  for (const order of orders) {
    const orderId = order.orderId;
    if (!orderId) continue;

    await importOrder(order, tenant, settings);

    // Claimed per-SKU, not per-order: a webhook may have already claimed one SKU on this order,
    // so each SKU races the webhook independently to avoid skipping or double-deducting.
    const lineItems = order.lineItems || [];
    let anyClaimed = false;

    for (const item of lineItems) {
      const sku = item.sku;
      const qty = Number(item.quantity) || 1;
      if (!sku) {
        logger.warn(`[ebay.orders] Line item in order ${orderId} has no SKU — skipping`);
        continue;
      }

      try {
        await ChannelProcessedEvent.create({
          platform: MARKETPLACE_PLATFORM.EBAY,
          orderId,
          sku,
          quantity: qty,
          action: "deduction",
          source: "poller",
        });
      } catch (err) {
        if (err.code === 11000) {
          logger.info(`[ebay.orders] Order ${orderId} SKU ${sku} deduction already recorded — skipping`);
          continue;
        }
        throw err;
      }

      anyClaimed = true;
      try {
        await adjustStockBySku(sku, -qty, tenant._id);
        logger.info(`[ebay.orders] Deducted ${qty} × ${sku} for order ${orderId}`);
      } catch (err) {
        logger.error(`[ebay.orders] Stock deduction failed for SKU ${sku}: ${err.message}`);
      }
    }

    if (anyClaimed) processed++;
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

      // Self-heal: a successful poll is proof the connection works again, clearing a stuck ERROR status.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      // One tenant's failure must never block the rest; markConnectionError surfaces it to the tenant.
      logger.error(`[ebay.orders] tenant ${tenant._id} poll failed: ${err.message}`);
      await markConnectionError(tenant._id, { message: err.message });
    }
  }

  logger.info(`[ebay.orders] Poll complete — ${processed} new / ${total} total across ${configured.length} tenant(s)`);
  return { processed, total, tenants: configured.length };
}

module.exports = { pollAndProcessOrders };
