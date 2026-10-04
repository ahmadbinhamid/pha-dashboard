// services/ebay/ebay.inventory-sync.service.js
// eBay -> app drift vs our baseline goes to review; never auto-applied.

const MarketplaceListing = require("../../models/MarketplaceListing");
const ebayApi = require("./ebay.api.service");
// Namespace imports, not destructured, so tests can mock.method() them.
const ebayTenant = require("./ebay.tenant");
const ebaySettingsService = require("./ebay.settings.service");
const { resolveSku } = require("../marketplace/listing.resolver");
const { upsertPending } = require("../pending-reconciliation.service");
const { deleteListing } = require("./ebay.listing.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

// Consecutive misses before a listing counts as deleted on eBay.
const MISSING_POLLS_THRESHOLD = 2;

// A streak, not one miss, so a flaky eBay response can't delete a live listing.
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

// Advances the pending-drift state machine one step for one listing.
async function reconcileListingDrift(listing, sku, ebayQty, tenantId) {
  // Confirmed live on eBay again: clear any missing streak.
  if (listing.ebay_missing_polls > 0) listing.ebay_missing_polls = 0;

  if (listing.ebay_synced_quantity == null) {
    // First time tracked: baseline it rather than guess at past drift.
    listing.ebay_synced_quantity = ebayQty;
    listing.ebay_synced_at = new Date();
    await listing.save();
    return { baselined: true, flagged: false };
  }

  if (listing.ebay_synced_quantity === ebayQty) {
    // Back in sync: clear any stale pending drift.
    if (listing.ebay_pending_reconcile_qty != null) listing.ebay_pending_reconcile_qty = null;
    // Still persist a missing-streak reset if one happened above.
    if (listing.isModified()) await listing.save();
    return { baselined: false, flagged: false };
  }

  if (listing.ebay_pending_reconcile_qty !== ebayQty) {
    // First sighting: eBay's read side may lag, so wait one more poll.
    listing.ebay_pending_reconcile_qty = ebayQty;
    await listing.save();
    logger.info(
      `[ebay.inventory-sync] SKU ${sku}: drift ${listing.ebay_synced_quantity} -> ${ebayQty} seen once, ` +
        `deferring to next poll before flagging`,
    );
    return { baselined: false, flagged: false };
  }

  // Seen twice: flag for review; auto-apply caused a false-restock incident.
  await upsertPending({
    tenantId,
    listingId: listing._id,
    sku,
    localQty: listing.ebay_synced_quantity,
    ebayQty,
  });
  logger.info(
    `[ebay.inventory-sync] flagged SKU ${sku} for review: local baseline ${listing.ebay_synced_quantity}, ` +
      `eBay reports ${ebayQty}`,
  );
  return { baselined: false, flagged: true };
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

      // Self-heal, as in ebay.orders.service.js: success proves the connection.
      if (settings.connection_status && settings.connection_status !== EBAY_CONNECTION_STATUS.CONNECTED) {
        await ebaySettingsService.markConnectionError(tenant._id, { status: EBAY_CONNECTION_STATUS.CONNECTED, message: null });
      }
    } catch (err) {
      summary.errors++;
      logger.error(`[ebay.inventory-sync] tenant ${tenant._id} reconciliation failed: ${err.message}`);
      // NOTE: a refused token flags reauth instead of a raw last_error.
      if (!(await ebayTenant.flagIfReauthRequired(tenant._id, err))) {
        await ebaySettingsService.markConnectionError(tenant._id, { message: err.message });
      }
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

  // Oldest per offer only: duplicates (index once missing live) loop drift.
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
      const result = await reconcileListingDrift(listing, sku, ebayQty, tenant._id);
      if (result.baselined) summary.baselined++;
      if (result.flagged) summary.flagged++;
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
