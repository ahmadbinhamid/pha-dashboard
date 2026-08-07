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
// Namespace imports (not destructured) — same reasoning as ebayApi above:
// keeps these mockable by tests regardless of when this module is first
// required, since a destructured reference is bound once at require time
// and a later mock.method() patch on the source module wouldn't be seen.
const ebayTenant = require("./ebay.tenant");
const ebaySettingsService = require("./ebay.settings.service");
const { resolveSku } = require("../marketplace/listing.resolver");
const { upsertPending } = require("../pendingReconciliation.service");
const { deleteListing } = require("./ebay.listing.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Consecutive misses required before we treat a listing as genuinely deleted
// on eBay (rather than a transient blip in that one poll) — see the schema
// comment on MarketplaceListing.ebay_missing_polls for why this isn't 1.
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

      // Self-heal — mirrors ebay.orders.service.js's poll loop: a successful
      // reconciliation is proof the connection works, even if a previous
      // cycle left connection_status stuck at ERROR/TOKEN_EXPIRED/REVOKED.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await ebaySettingsService.markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      summary.errors++;
      // Previously only logged — connection_status never reflected a
      // revoked/expired token, so a broken integration failed silently and
      // indefinitely instead of surfacing to the tenant. Found live.
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
        // First time we've tracked this listing — establish a baseline
        // instead of guessing at any historical drift.
        listing.ebay_synced_quantity = ebayQty;
        listing.ebay_synced_at = new Date();
        await listing.save();
        summary.baselined++;
        continue;
      }

      if (listing.ebay_synced_quantity === ebayQty) {
        // Confirmed back in sync — eBay's own read side caught up (or
        // nothing changed). Clear any pending drift so a stale one-off
        // reading can't get combined with a later, unrelated drift.
        if (listing.ebay_pending_reconcile_qty != null) listing.ebay_pending_reconcile_qty = null;
        // Nothing to reconcile, but still persist a missing-streak reset if
        // one happened above — otherwise it's silently lost on this path.
        if (listing.isModified()) await listing.save();
        continue;
      }

      if (listing.ebay_pending_reconcile_qty !== ebayQty) {
        // First poll to see this exact drift — eBay's GetInventoryItem API
        // can still be catching up to an order we just processed (a push
        // we made, or an eBay-side sale we already deducted for). Don't
        // flag anything yet; just remember what we saw and check again
        // next poll — most of these self-resolve within one cycle and
        // never need a human to look at them.
        listing.ebay_pending_reconcile_qty = ebayQty;
        await listing.save();
        logger.info(
          `[ebay.inventory-sync] SKU ${sku}: drift ${listing.ebay_synced_quantity} -> ${ebayQty} seen once, ` +
            `deferring to next poll before flagging`,
        );
        continue;
      }

      // Same drift confirmed on a second consecutive poll. This is never
      // applied to stock automatically — see PendingReconciliation's model
      // comment for why (this exact auto-apply step is what caused the
      // Aug 2026 false-restock incident). Flag it for a human to review via
      // GET/POST /inventory/reconciliations instead.
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
