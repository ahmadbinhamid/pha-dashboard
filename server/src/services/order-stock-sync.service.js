// services/order-stock-sync.service.js
//
// Keeps local inventory and eBay's listed quantity in sync when a Stripe
// payment succeeds (deduct) or a full refund/cancellation restocks (credit).
// Shared by stripe.webhook.service.js and stripe.refund.service.js so the
// dual-write (local DB + eBay push) logic lives in exactly one place.
//
// Does NOT enqueue its own push to eBay — adjustStockForSku already fans out
// via inventory.service.js#fanOutMarketplaceInventory (the one place that
// claims a push_seq fencing token and enqueues sync_listing), and returns
// that result as `marketplaceResults`. This file just reads it to set each
// order line's ebay_sync_status/ebay_sync_error, instead of making a second,
// separately-fenced (or worse, unfenced) push for the same event.

const { adjustStockForSku, resolveSkuToIds, fanOutMarketplaceInventory } = require("./inventory.service");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { formatOrderNumber } = require("../utils/orderNumberFormat");

const DIRECTION = { DEDUCT: "deduct", RESTOCK: "restock" };

// Derives an order line's ebay_sync_status/ebay_sync_error from a
// fanOutMarketplaceInventory result — "pending" if at least one listing was
// queued, "not_applicable" if this product has no marketplace listings at
// all, "failed" (with the underlying error) if a listing exists but
// couldn't be queued.
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

// Mutates each order.items[i] with ebay_sync_status/ebay_sync_error IN THE
// DEFAULT (lines: null) MODE ONLY — caller is responsible for order.save()
// afterwards, same as always. Returns whether any line item couldn't be
// fully covered locally (oversell) so the caller can flag the order.
//
// `reasonPrefix`/`saleType`/`refundType` let non-Stripe callers (e.g. a
// manual/in-store sale) label the InventoryHistory audit trail accurately —
// they default to the original Stripe wording so existing call sites are
// unaffected.
//
// refund-redesign-spec.md §3.6 — `lines` (an array of
// `{ order_item_id, sku, quantity }`) lets a refund restock only specific
// items at partial quantities, instead of every order.items[i] at full
// item.quantity. Defaulting to null preserves the exact existing behaviour
// for handlePaymentSucceeded and order.service.js's createManualOrder — ONLY
// pass `lines` from the new refund restock path (§3.7/§7).
//
// When `lines` is given, results are returned per-line in `lineResults`
// instead of being written onto order.items[i].ebay_sync_status — that
// field is a single slot per item, and a SECOND partial refund on the same
// line would silently overwrite the first refund's sync trail. The caller
// (refund.service.js#applyRefundEffects) writes lineResults onto the
// specific refund.lines[] entries instead, where each refund keeps its own
// independent trail.
async function syncOrderStock(order, direction, { reasonPrefix, saleType, refundType, lines = null, refundId = null } = {}) {
  let hasShortfall = false;
  const notes = [];
  const lineResults = [];
  const partial = lines !== null;
  const iterable = partial ? lines : order.items;

  for (const entry of iterable) {
    // Normalize the two shapes ({sku, quantity, order_item_id} for a partial
    // restock vs a full order.items[i] subdocument) to one local shape.
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
      // No inventory record at all for this SKU — nothing to push to eBay
      // either; flag for manual attention rather than silently skipping.
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

// refund-redesign-spec.md §2.3 — POST /refunds/:id/retry-restock. Deliberately
// NOT another call to syncOrderStock: the local stock adjustment for a
// failed-eBay-push line already succeeded (that's a separate concern from
// whether the eBay notification made it) — re-running syncOrderStock would
// double-deduct/double-restock the physical count. No need to re-read the
// SKU's current total here either — sync_listing resolves quantity fresh
// from the DB at job-run time (see ebay.adapter.js#resolveQuantity), not
// from a caller-supplied number — so this just (re-)queues the push
// directly, the same way adjustStock's internal call would have, since this
// retry path isn't itself going through adjustStockForSku.
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
