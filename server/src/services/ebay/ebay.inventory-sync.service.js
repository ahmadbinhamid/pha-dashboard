// services/ebay/ebay.inventory-sync.service.js
// Flags eBay-side quantity drift for human review and removes listings deleted directly on eBay.
// Direction: eBay -> App (opposite of order-stock-sync.service.js). Diffs eBay's live quantity against
// our expected-quantity baseline, not local stock; confirmed mismatches go to PendingReconciliation, never auto-applied.

const MarketplaceListing = require("../../models/MarketplaceListing");
const ebayApi = require("./ebay.api.service");
// Namespace imports (not destructured) so tests can mock.method() the source module after require.
const ebayTenant = require("./ebay.tenant");
const ebaySettingsService = require("./ebay.settings.service");
const { resolveSku } = require("../marketplace/listing.resolver");
const { upsertPending } = require("../pendingReconciliation.service");
const { deleteListing } = require("./ebay.listing.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Consecutive misses before treating a listing as genuinely deleted on eBay, not a transient blip.
const MISSING_POLLS_THRESHOLD = 2;

// Listing was found absent from eBay's inventory list this poll. Tracks a
// streak rather than acting on a single miss, so one flaky eBay API response
// can't wrongly delete a listing that's still actually live.
async function handleMissingFromEbay(listing, sku, tenantId) {
  const streak = (listing.ebay_missing_polls || 0) + 1;

  if (streak < MISSING_POLLS_THRESHOLD) {
    listing.ebay_missing_polls = streak;
    await listing.save();
    return { deleted: false };
  }

  logger.warn(
    `[ebay.inventory-sync] SKU ${sku} missing from eBay for ${streak} consecutive polls — ` +
      `treating as deleted on eBay and removing listing ${listing._id} locally`,
  );
  await deleteListing(listing._id, tenantId);
  return { deleted: true };
}

async function reconcileEbayInventory() {
  const configured = await ebayTenant.getConfiguredTenants();
  const summary = { checked: 0, flagged: 0, baselined: 0, deletedFromEbay: 0, errors: 0 };

  if (!configured.length) {
    logger.info("[ebay.inventory-sync] no tenants have eBay configured — skipping");
    return summary;
  }

  for (const { tenant, settings } of configured) {
    try {
      const tenantSummary = await reconcileEbayInventoryForTenant(tenant, settings);
      summary.checked += tenantSummary.checked;
      summary.flagged += tenantSummary.flagged;
      summary.baselined += tenantSummary.baselined;
      summary.deletedFromEbay += tenantSummary.deletedFromEbay;
      summary.errors += tenantSummary.errors;

      // Self-heal (mirrors ebay.orders.service.js): success is proof the connection works again.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await ebaySettingsService.markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      summary.errors++;
      logger.error(`[ebay.inventory-sync] tenant ${tenant._id} reconciliation failed: ${err.message}`);
      await ebaySettingsService.markConnectionError(tenant._id, { message: err.message });
    }
  }

  logger.info(
    `[ebay.inventory-sync] run complete: checked=${summary.checked} flagged=${summary.flagged} ` +
      `baselined=${summary.baselined} deletedFromEbay=${summary.deletedFromEbay} errors=${summary.errors}`,
  );

  return summary;
}

async function reconcileEbayInventoryForTenant(tenant, settings) {
  const rawListings = await MarketplaceListing.find({
    tenant_id: tenant._id,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_offer_id: { $ne: null },
    deleted_at: null,
  })
    .populate("product")
    .populate("variant");

  // Defensive dedup: external_offer_id should be unique via a DB index, but if that index is
  // missing (found live), duplicates would cause a self-sustaining drift. Keep only the oldest per offer.
  const byOfferId = new Map();
  for (const listing of rawListings) {
    const existing = byOfferId.get(listing.external_offer_id);
    if (!existing || listing.created_at < existing.created_at) {
      byOfferId.set(listing.external_offer_id, listing);
    }
  }
  if (byOfferId.size < rawListings.length) {
    logger.warn(
      `[ebay.inventory-sync] tenant ${tenant._id}: found ${rawListings.length - byOfferId.size} ` +
        `duplicate active listing(s) sharing an external_offer_id with another listing — reconciling ` +
        `only the oldest of each. This is a data integrity issue, not expected steady-state; see ops runbook.`,
    );
  }
  const listings = [...byOfferId.values()];

  const summary = { checked: 0, flagged: 0, baselined: 0, deletedFromEbay: 0, errors: 0 };

  if (!listings.length) {
    return summary;
  }

  const { items: ebayItems, complete } = await ebayApi.getAllInventoryItems(settings);
  if (!complete) {
    logger.warn(
      `[ebay.inventory-sync] tenant ${tenant._id}: getAllInventoryItems returned an incomplete page set — ` +
        `skipping missing-listing detection for this cycle (quantity drift checks below still run on ` +
        `whatever SKUs we DID get back, since a false "still there, same quantity" is harmless, but a false ` +
        `"missing" is not).`,
    );
  }

  const ebayQtyBySku = new Map();
  for (const item of ebayItems) {
    const qty = item.availability?.shipToLocationAvailability?.quantity;
    if (item.sku && qty != null) ebayQtyBySku.set(item.sku, qty);
  }

  for (const listing of listings) {
    if (!listing.product) continue; // product deleted out from under an old listing

    const sku = resolveSku(listing, listing.product, listing.variant);
    const ebayQty = ebayQtyBySku.get(sku);
    summary.checked++;

    if (ebayQty == null) {
      if (!complete) continue; // can't trust "missing" from a truncated fetch
      try {
        const result = await handleMissingFromEbay(listing, sku, tenant._id);
        if (result.deleted) summary.deletedFromEbay++;
      } catch (err) {
        summary.errors++;
        logger.error(`[ebay.inventory-sync] failed to process missing SKU ${sku}: ${err.message}`);
      }
      continue;
    }

    try {
      // Listing is confirmed live on eBay again — clear any missing streak.
      if (listing.ebay_missing_polls > 0) listing.ebay_missing_polls = 0;

      if (listing.ebay_synced_quantity == null) {
        // First time tracked — establish a baseline instead of guessing at historical drift.
        listing.ebay_synced_quantity = ebayQty;
        listing.ebay_synced_at = new Date();
        await listing.save();
        summary.baselined++;
        continue;
      }

      if (listing.ebay_synced_quantity === ebayQty) {
        // Confirmed back in sync — clear any stale pending drift.
        if (listing.ebay_pending_reconcile_qty != null) listing.ebay_pending_reconcile_qty = null;
        // Still persist a missing-streak reset if one happened above.
        if (listing.isModified()) await listing.save();
        continue;
      }

      if (listing.ebay_pending_reconcile_qty !== ebayQty) {
        // First poll to see this drift — eBay's read side may still be catching up; defer to next poll.
        listing.ebay_pending_reconcile_qty = ebayQty;
        await listing.save();
        logger.info(
          `[ebay.inventory-sync] SKU ${sku}: drift ${listing.ebay_synced_quantity} -> ${ebayQty} seen once, ` +
            `deferring to next poll before flagging`,
        );
        continue;
      }

      // Drift confirmed twice — never auto-apply to stock (caused the Aug 2026 false-restock incident);
      // flag for human review via GET/POST /inventory/reconciliations instead.
      await upsertPending({
        tenantId: tenant._id,
        listingId: listing._id,
        sku,
        localQty: listing.ebay_synced_quantity,
        ebayQty,
      });
      summary.flagged++;
      logger.info(
        `[ebay.inventory-sync] flagged SKU ${sku} for review: local baseline ${listing.ebay_synced_quantity}, ` +
          `eBay reports ${ebayQty}`,
      );
    } catch (err) {
      summary.errors++;
      logger.error(`[ebay.inventory-sync] failed to reconcile SKU ${sku}: ${err.message}`);
    }
  }

  logger.info(
    `[ebay.inventory-sync] tenant ${tenant._id}: checked=${summary.checked} flagged=${summary.flagged} ` +
      `baselined=${summary.baselined} deletedFromEbay=${summary.deletedFromEbay} errors=${summary.errors}`,
  );

  return summary;
}

module.exports = { reconcileEbayInventory };
