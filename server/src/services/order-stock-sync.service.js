// services/order-stock-sync.service.js
//
// Keeps local inventory and eBay's listed quantity in sync when a Stripe
// payment succeeds (deduct) or a full refund/cancellation restocks (credit).
// Shared by stripe.webhook.service.js and stripe.refund.service.js so the
// dual-write (local DB + eBay push) logic lives in exactly one place.

const { adjustStockForSku, resolveSkuToIds } = require("./inventory.service");
const { enqueueEbayJob } = require("../queues/ebay.queue");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");
const { formatOrderNumber } = require("../utils/orderNumberFormat");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

const DIRECTION = { DEDUCT: "deduct", RESTOCK: "restock" };

// Atomically claims the next fencing token for this SKU's eBay listing.
// Returns null (no fencing applied) when there's no matching listing yet —
// the worker treats a missing seq as "always apply", same as before this
// change, so a push for a SKU without a MarketplaceListing record still
// behaves exactly as it did.
async function claimPushSeq(sku, tenantId) {
  try {
    const ids = await resolveSkuToIds(sku, tenantId);
    if (!ids) return null;
    const MarketplaceListing = require("../models/MarketplaceListing");
    const listing = await MarketplaceListing.findOneAndUpdate(
      {
        tenant_id: tenantId,
        product: ids.productId,
        variant: ids.variantId || null,
        platform: MARKETPLACE_PLATFORM.EBAY,
      },
      { $inc: { push_seq: 1 } },
      // push_seq is an eBay-discriminator-only field — see the matching
      // comment on ebay.adapter.js#updateSyncBaseline for why a base-model
      // update needs strict: false or this silently never increments.
      { new: true, strict: false },
    ).select("push_seq");
    return listing ? listing.push_seq : null;
  } catch (err) {
    logger.warn(`[order-stock-sync] claimPushSeq failed for SKU ${sku}: ${err.message}`);
    return null;
  }
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

    if (!partial) {
      await pushEbayQuantity(entry, result.totalStockAfter, order.tenant_id);
    } else {
      const pushTarget = { sku, ebay_sync_status: null, ebay_sync_error: null };
      await pushEbayQuantity(pushTarget, result.totalStockAfter, order.tenant_id);
      lineResults.push({
        order_item_id: orderItemId,
        ebay_sync_status: pushTarget.ebay_sync_status,
        ebay_sync_error: pushTarget.ebay_sync_error,
        shortfall: direction === DIRECTION.DEDUCT ? result.shortfall : 0,
      });
    }
  }

  return { hasShortfall, note: notes.join("; ") || null, lineResults };
}

// Never makes a live call to eBay inline — that used to mean every
// order/refund request blocked on eBay's API being fast (or even up) before
// it could respond. Handing the push to the same `push_quantity` job
// ebay.worker.js already runs (previously only the retry path for a failed
// inline push) means this only ever costs a fast Redis write, not a live
// HTTP round trip. Trades off knowing synced/failed immediately — the order
// now saves with "pending" and the job resolves it asynchronously.
async function pushEbayQuantity(item, quantity, tenantId) {
  item.ebay_sync_status = "pending";
  item.ebay_sync_error = null;
  try {
    // Fencing token — claimed atomically here (at enqueue time, not job-run
    // time) so two pushes for the same SKU enqueued close together get
    // strictly increasing seqs in the order they were actually requested.
    // The worker drops any job whose seq is older than what's already
    // landed, so a slow/retried push can't come back later and overwrite a
    // newer quantity with a stale one. See MarketplaceListing.js's
    // push_seq/last_pushed_seq schema comment.
    const seq = await claimPushSeq(item.sku, tenantId);
    // tenantId travels with the job so the worker's SKU resolution is scoped
    // to the right tenant, not the job data — see ebay.adapter.js#pushInventory.
    await enqueueEbayJob("push_quantity", { sku: item.sku, quantity, tenantId, seq });
  } catch (qErr) {
    logger.warn(`[order-stock-sync] could not enqueue eBay push for SKU ${item.sku}`, {
      error: qErr.message,
    });
    item.ebay_sync_status = "failed";
    item.ebay_sync_error = qErr.message;
  }
}

// refund-redesign-spec.md §2.3 — POST /refunds/:id/retry-restock. Deliberately
// NOT another call to syncOrderStock: the local stock adjustment for a
// failed-eBay-push line already succeeded (that's a separate concern from
// whether the eBay notification made it) — re-running syncOrderStock would
// double-deduct/double-restock the physical count. This only re-reads the
// SKU's current total (already-correct) stock and re-attempts the eBay push.
async function retryEbayPushForSku(sku, tenantId) {
  const { getTotalStockForProductVariant, resolveSkuToIds } = require("./inventory.service");
  const ids = await resolveSkuToIds(sku, tenantId);
  if (!ids) {
    return { ebay_sync_status: "not_applicable", ebay_sync_error: null };
  }
  const totalStockAfter = await getTotalStockForProductVariant(ids.productId, ids.variantId);
  const pushTarget = { sku, ebay_sync_status: null, ebay_sync_error: null };
  await pushEbayQuantity(pushTarget, totalStockAfter, tenantId);
  return { ebay_sync_status: pushTarget.ebay_sync_status, ebay_sync_error: pushTarget.ebay_sync_error };
}

module.exports = { syncOrderStock, retryEbayPushForSku, DIRECTION };
