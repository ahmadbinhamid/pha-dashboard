// services/order-stock-sync.service.js
// Keeps local inventory and eBay's listed quantity in sync on payment success (deduct) or
// refund/cancellation (restock), shared by stripe.webhook.service.js and stripe.refund.service.js.
// Does not enqueue its own eBay push — reads adjustStockForSku's marketplaceResults instead of
// making a second, separately-fenced push.

const { adjustStockForSku, resolveSkuToIds, fanOutMarketplaceInventory } = require("./inventory.service");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { formatOrderNumber } = require("../utils/orderNumberFormat");

const DIRECTION = { DEDUCT: "deduct", RESTOCK: "restock" };

// Derives ebay_sync_status/ebay_sync_error from a fanOutMarketplaceInventory result.
function statusFromMarketplaceResults(marketplaceResults) {
  if (!marketplaceResults || marketplaceResults.length === 0) {
    return { ebay_sync_status: "not_applicable", ebay_sync_error: null };
  }
  const failed = marketplaceResults.find((r) => !r.queued);
  if (failed) {
    return { ebay_sync_status: "failed", ebay_sync_error: failed.error || "Failed to queue eBay sync" };
  }
  return { ebay_sync_status: "pending", ebay_sync_error: null };
}

// Mutates each order.items[i] in the default (lines: null) mode only — caller saves the order.
// Returns whether any line couldn't be fully covered locally, so the caller can flag the order.
// `lines` (an array of {order_item_id, sku, quantity}) lets a refund restock only specific items
// at partial quantities; when given, results come back per-line in `lineResults` instead of
// being written onto order.items[i].ebay_sync_status, since a second partial refund on the
// same line would otherwise overwrite the first one's sync trail.
async function syncOrderStock(order, direction, { reasonPrefix, saleType, refundType, lines = null, refundId = null } = {}) {
  let hasShortfall = false;
  const notes = [];
  const lineResults = [];
  const partial = lines !== null;
  const iterable = partial ? lines : order.items;

  for (const entry of iterable) {
    // Normalize the two shapes (partial restock vs full order.items[i] subdocument).
    const sku = partial ? entry.sku : entry.sku;
    const quantity = partial ? entry.quantity : entry.quantity;
    const orderItemId = partial ? entry.order_item_id : null;

    if (!sku) {
      if (!partial) entry.ebay_sync_status = "not_applicable";
      else lineResults.push({ order_item_id: orderItemId, ebay_sync_status: "not_applicable", ebay_sync_error: null, shortfall: 0 });
      continue;
    }

    const sign = direction === DIRECTION.DEDUCT ? -1 : 1;
    const delta = sign * quantity;
    const refundSuffix = refundId ? `, refund ${refundId}` : "";
    const reason =
      direction === DIRECTION.DEDUCT
        ? `${reasonPrefix ?? "Stripe sale"} (order ${formatOrderNumber(order.order_number_prefix, order.order_number)}${refundSuffix})`
        : `${reasonPrefix ?? "Stripe refund/cancellation restock"} (order ${formatOrderNumber(order.order_number_prefix, order.order_number)}${refundSuffix})`;

    const result = await adjustStockForSku(sku, delta, {
      reason,
      type:
        direction === DIRECTION.DEDUCT
          ? (saleType ?? ADJUSTMENT_TYPE.STRIPE_SALE)
          : (refundType ?? ADJUSTMENT_TYPE.STRIPE_REFUND),
      userId: null,
      tenantId: order.tenant_id,
    });

    if (!result) {
      // No inventory record for this SKU — flag for manual attention rather than silently skipping.
      hasShortfall = true;
      notes.push(`No inventory record found for SKU ${sku}`);
      if (!partial) entry.ebay_sync_status = "not_applicable";
      else lineResults.push({ order_item_id: orderItemId, ebay_sync_status: "not_applicable", ebay_sync_error: null, shortfall: 0 });
      continue;
    }

    if (direction === DIRECTION.DEDUCT && result.shortfall > 0) {
      hasShortfall = true;
      notes.push(`Oversold "${partial ? entry.name || sku : entry.name}" (SKU ${sku}) by ${result.shortfall}`);
    }

    const { ebay_sync_status, ebay_sync_error } = statusFromMarketplaceResults(result.marketplaceResults);

    if (!partial) {
      entry.ebay_sync_status = ebay_sync_status;
      entry.ebay_sync_error = ebay_sync_error;
    } else {
      lineResults.push({
        order_item_id: orderItemId,
        ebay_sync_status,
        ebay_sync_error,
        shortfall: direction === DIRECTION.DEDUCT ? result.shortfall : 0,
      });
    }
  }

  return { hasShortfall, note: notes.join("; ") || null, lineResults };
}

// POST /refunds/:id/retry-restock. Deliberately not another syncOrderStock call — the local
// stock adjustment already succeeded, so re-running it would double-deduct/restock. Just
// (re-)queues the push directly; sync_listing resolves quantity fresh from the DB at job-run time.
async function retryEbayPushForSku(sku, tenantId) {
  const ids = await resolveSkuToIds(sku, tenantId);
  if (!ids) {
    return { ebay_sync_status: "not_applicable", ebay_sync_error: null };
  }
  try {
    const marketplaceResults = await fanOutMarketplaceInventory(ids.productId, ids.variantId, tenantId);
    return statusFromMarketplaceResults(marketplaceResults);
  } catch (err) {
    logger.warn(`[order-stock-sync] retryEbayPushForSku failed for SKU ${sku}: ${err.message}`);
    return { ebay_sync_status: "failed", ebay_sync_error: err.message };
  }
}

module.exports = { syncOrderStock, retryEbayPushForSku, DIRECTION };
