// services/ebay/ebay.inventory-sync.service.js
//
// Reconciles eBay-side inventory quantity edits (e.g. a seller manually
// changing "Available quantity" in eBay Seller Hub) back into local stock,
// and removes listings locally once they've been deleted directly on eBay.
// Runs on a schedule from the eBay worker — see src/workers/ebay.worker.js.
//
// Direction: eBay -> App. The opposite direction (App -> eBay) is handled by
// order-stock-sync.service.js and ebay.adapter.js's publish/update/pushInventory,
// which also keep MarketplaceListing.ebay_synced_quantity current so this job
// only reacts to changes that did NOT originate from our own pushes — it
// diffs eBay's live quantity against that baseline, not against local stock
// directly, and applies just the difference (never a blind overwrite) so a
// storefront sale that happened in between polls isn't clobbered.

const MarketplaceListing = require("../../models/MarketplaceListing");
const ebayApi = require("./ebay.api.service");
const { getConfiguredTenants } = require("./ebay.tenant");
const { markConnectionError } = require("./ebay.settings.service");
const { resolveSku } = require("../marketplace/listing.resolver");
const { adjustStockForSku } = require("../inventory.service");
const { deleteListing } = require("./ebay.listing.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const { ADJUSTMENT_TYPE } = require("../../constants/inventory.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Consecutive misses required before we treat a listing as genuinely deleted
// on eBay (rather than a transient blip in that one poll) — see the schema
// comment on MarketplaceListing.ebay_missing_polls for why this isn't 1.
const MISSING_POLLS_THRESHOLD = 2;

// Listing was found absent from eBay's inventory list this poll. Tracks a
// streak rather than acting on a single miss, so one flaky eBay API response
// can't wrongly delete a listing that's still actually live.
async function handleMissingFromEbay(listing, sku) {
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
  await deleteListing(listing._id);
  return { deleted: true };
}

async function reconcileEbayInventory() {
  const configured = await getConfiguredTenants();
  const summary = { checked: 0, reconciled: 0, baselined: 0, deletedFromEbay: 0, errors: 0 };

  if (!configured.length) {
    logger.info("[ebay.inventory-sync] no tenants have eBay configured — skipping");
    return summary;
  }

  for (const { tenant, settings } of configured) {
    try {
      const tenantSummary = await reconcileEbayInventoryForTenant(tenant, settings);
      summary.checked += tenantSummary.checked;
      summary.reconciled += tenantSummary.reconciled;
      summary.baselined += tenantSummary.baselined;
      summary.deletedFromEbay += tenantSummary.deletedFromEbay;
      summary.errors += tenantSummary.errors;

      // Self-heal — mirrors ebay.orders.service.js's poll loop: a successful
      // reconciliation is proof the connection works, even if a previous
      // cycle left connection_status stuck at ERROR/TOKEN_EXPIRED/REVOKED.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      summary.errors++;
      // Previously only logged — connection_status never reflected a
      // revoked/expired token, so a broken integration failed silently and
      // indefinitely instead of surfacing to the tenant. Found live.
      logger.error(`[ebay.inventory-sync] tenant ${tenant._id} reconciliation failed: ${err.message}`);
      await markConnectionError(tenant._id, { message: err.message });
    }
  }

  logger.info(
    `[ebay.inventory-sync] run complete: checked=${summary.checked} reconciled=${summary.reconciled} ` +
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

  // Defensive dedup — this collection SHOULD be guaranteed unique per
  // external_offer_id by a DB index (see MarketplaceListing.js), but if that
  // index is ever missing/not yet built (found live: it wasn't), two local
  // records can silently share one real eBay offer. Reconciling both against
  // the same underlying stock each poll — each tracking its own independent
  // "last known quantity" for what's really one number — creates a
  // self-sustaining +1-per-cycle drift with no human or eBay-side action
  // involved. Keeping only the oldest record per offer here makes this
  // job safe even while duplicates still exist in the data; it does not fix
  // the duplicates themselves (see scripts note / ops runbook for cleanup +
  // rebuilding the missing unique indexes).
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

  const summary = { checked: 0, reconciled: 0, baselined: 0, deletedFromEbay: 0, errors: 0 };

  if (!listings.length) {
    return summary;
  }

  const ebayItems = await ebayApi.getAllInventoryItems(settings);

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
      try {
        const result = await handleMissingFromEbay(listing, sku);
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
        // First time we've tracked this listing — establish a baseline
        // instead of guessing at any historical drift.
        listing.ebay_synced_quantity = ebayQty;
        await listing.save();
        summary.baselined++;
        continue;
      }

      if (listing.ebay_synced_quantity === ebayQty) {
        // Nothing to reconcile, but still persist a missing-streak reset if
        // one happened above — otherwise it's silently lost on this path.
        if (listing.isModified("ebay_missing_polls")) await listing.save();
        continue;
      }

      const delta = ebayQty - listing.ebay_synced_quantity;
      await adjustStockForSku(sku, delta, {
        reason: `eBay quantity changed directly on eBay (was ${listing.ebay_synced_quantity}, now ${ebayQty})`,
        type: ADJUSTMENT_TYPE.EBAY_MANUAL_ADJUSTMENT,
        userId: null,
        tenantId: tenant._id,
      });

      listing.ebay_synced_quantity = ebayQty;
      await listing.save();
      summary.reconciled++;
      logger.info(
        `[ebay.inventory-sync] reconciled SKU ${sku}: ${delta > 0 ? "+" : ""}${delta} (eBay now ${ebayQty})`,
      );
    } catch (err) {
      summary.errors++;
      logger.error(`[ebay.inventory-sync] failed to reconcile SKU ${sku}: ${err.message}`);
    }
  }

  logger.info(
    `[ebay.inventory-sync] tenant ${tenant._id}: checked=${summary.checked} reconciled=${summary.reconciled} ` +
      `baselined=${summary.baselined} deletedFromEbay=${summary.deletedFromEbay} errors=${summary.errors}`,
  );

  return summary;
}

module.exports = { reconcileEbayInventory };
