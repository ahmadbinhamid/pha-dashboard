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
const { markConnectionError } = require("./ebay.settings.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Order import has its own idempotency (Order.external_order_id) independent
// of the stock-deduction guard below, so it runs for every polled order —
// including ones whose stock was already deducted in an earlier run, e.g.
// orders that came in before this import feature existed.
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

    // Claimed per-line-item, not per-order — eBay order IDs are globally
    // unique platform-wide, so this ledger needs no tenant scoping to stay
    // correct, but it DOES need to be keyed per SKU: a webhook may have
    // already claimed (and deducted) one SKU on this order by the time the
    // poller gets here, and a per-order claim would either skip the whole
    // order (missing the poller's chance to cover any OTHER SKU the webhook
    // didn't reach) or, worse, re-claim and double-deduct a SKU the webhook
    // already handled. Each SKU races the webhook independently instead.
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
        await EbayProcessedOrder.create({
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

      // Self-heal: a revoked/expired token previously left connection_status
      // stuck at ERROR forever, since nothing ever cleared it once the
      // tenant re-authorized (or the underlying issue was transient) — this
      // poll succeeding is the actual proof the connection works again.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      // One tenant's eBay outage/auth failure must never block the rest.
      // Previously only logged — markConnectionError (defined for exactly
      // this) was never called, so connection_status stayed CONNECTED
      // indefinitely even for a permanently revoked token, and nothing ever
      // surfaced the break to the tenant. Found live.
      logger.error(`[ebay.orders] tenant ${tenant._id} poll failed: ${err.message}`);
      await markConnectionError(tenant._id, { message: err.message });
    }
  }

  logger.info(`[ebay.orders] Poll complete — ${processed} new / ${total} total across ${configured.length} tenant(s)`);
  return { processed, total, tenants: configured.length };
}

module.exports = { pollAndProcessOrders };
