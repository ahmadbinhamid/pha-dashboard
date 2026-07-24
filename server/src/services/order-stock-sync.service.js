// services/order-stock-sync.service.js
//
// Keeps local inventory and eBay's listed quantity in sync when a Stripe
// payment succeeds (deduct) or a full refund/cancellation restocks (credit).
// Shared by stripe.webhook.service.js and stripe.refund.service.js so the
// dual-write (local DB + eBay push) logic lives in exactly one place.

const { adjustStockForSku } = require("./inventory.service");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

const DIRECTION = { DEDUCT: "deduct", RESTOCK: "restock" };

// Mutates each order.items[i] with ebay_sync_status/ebay_sync_error. Caller
// is responsible for order.save() afterwards. Returns whether any line item
// couldn't be fully covered locally (oversell) so the caller can flag the order.
//
// `reasonPrefix`/`saleType`/`refundType` let non-Stripe callers (e.g. a
// manual/in-store sale) label the InventoryHistory audit trail accurately —
// they default to the original Stripe wording so existing call sites are
// unaffected.
async function syncOrderStock(order, direction, { reasonPrefix, saleType, refundType } = {}) {
  let hasShortfall = false;
  const notes = [];

  for (const item of order.items) {
    if (!item.sku) {
      item.ebay_sync_status = "not_applicable";
      continue;
    }

    const sign = direction === DIRECTION.DEDUCT ? -1 : 1;
    const delta = sign * item.quantity;
    const reason =
      direction === DIRECTION.DEDUCT
        ? `${reasonPrefix ?? "Stripe sale"} (order ${order.order_number})`
        : `${reasonPrefix ?? "Stripe refund/cancellation restock"} (order ${order.order_number})`;

    const result = await adjustStockForSku(item.sku, delta, {
      reason,
      type:
        direction === DIRECTION.DEDUCT
          ? (saleType ?? ADJUSTMENT_TYPE.STRIPE_SALE)
          : (refundType ?? ADJUSTMENT_TYPE.STRIPE_REFUND),
      userId: null,
    });

    if (!result) {
      // No inventory record at all for this SKU — nothing to push to eBay
      // either; flag for manual attention rather than silently skipping.
      hasShortfall = true;
      notes.push(`No inventory record found for SKU ${item.sku}`);
      item.ebay_sync_status = "not_applicable";
      continue;
    }

    if (direction === DIRECTION.DEDUCT && result.shortfall > 0) {
      hasShortfall = true;
      notes.push(`Oversold "${item.name}" (SKU ${item.sku}) by ${result.shortfall}`);
    }

    await pushEbayQuantity(item, result.totalStockAfter);
  }

  return { hasShortfall, note: notes.join("; ") || null };
}

async function pushEbayQuantity(item, quantity) {
  try {
    // Lazy-require to avoid a hard dependency on the eBay adapter module
    // graph for stores that don't have eBay configured.
    const { pushInventory } = require("./marketplace/adapters/ebay.adapter");
    await pushInventory(item.sku, quantity);
    item.ebay_sync_status = "synced";
    item.ebay_sync_error = null;
  } catch (err) {
    // eBay availability must never block payment/refund processing — log,
    // flag for retry, and enqueue a background retry job. Payment/refund
    // success in our DB is authoritative regardless of eBay's availability.
    logger.warn(`[order-stock-sync] eBay push failed for SKU ${item.sku}`, { error: err.message });
    item.ebay_sync_status = "failed";
    item.ebay_sync_error = err.message;
    try {
      await enqueueEbayJob("push_quantity", { sku: item.sku, quantity });
    } catch (qErr) {
      logger.warn(`[order-stock-sync] could not enqueue eBay retry for SKU ${item.sku}`, {
        error: qErr.message,
      });
    }
  }
}

module.exports = { syncOrderStock, DIRECTION };
