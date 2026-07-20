// services/ebay/ebay.inventory-sync.service.js
//
// Reconciles eBay-side inventory quantity edits (e.g. a seller manually
// changing "Available quantity" in eBay Seller Hub) back into local stock.
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
const { resolveSku } = require("../marketplace/listing.resolver");
const { adjustStockForSku } = require("../inventory.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");
const { ADJUSTMENT_TYPE } = require("../../constants/inventory.constants");

async function reconcileEbayInventory() {
  const listings = await MarketplaceListing.find({
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_offer_id: { $ne: null },
    deleted_at: null,
  })
    .populate("product")
    .populate("variant");

  const summary = { checked: 0, reconciled: 0, baselined: 0, errors: 0 };

  if (!listings.length) {
    logger.info("[ebay.inventory-sync] no active eBay listings to reconcile");
    return summary;
  }

  const ebayItems = await ebayApi.getAllInventoryItems();

  const ebayQtyBySku = new Map();
  for (const item of ebayItems) {
    const qty = item.availability?.shipToLocationAvailability?.quantity;
    if (item.sku && qty != null) ebayQtyBySku.set(item.sku, qty);
  }

  for (const listing of listings) {
    if (!listing.product) continue; // product deleted out from under an old listing

    const sku = resolveSku(listing, listing.product, listing.variant);
    const ebayQty = ebayQtyBySku.get(sku);
    if (ebayQty == null) continue; // not currently live on eBay — nothing to reconcile

    summary.checked++;

    try {
      if (listing.ebay_synced_quantity == null) {
        // First time we've tracked this listing — establish a baseline
        // instead of guessing at any historical drift.
        listing.ebay_synced_quantity = ebayQty;
        await listing.save();
        summary.baselined++;
        continue;
      }

      if (listing.ebay_synced_quantity === ebayQty) continue; // no change since last check

      const delta = ebayQty - listing.ebay_synced_quantity;
      await adjustStockForSku(sku, delta, {
        reason: `eBay quantity changed directly on eBay (was ${listing.ebay_synced_quantity}, now ${ebayQty})`,
        type: ADJUSTMENT_TYPE.EBAY_MANUAL_ADJUSTMENT,
        userId: null,
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
    `[ebay.inventory-sync] run complete: checked=${summary.checked} reconciled=${summary.reconciled} baselined=${summary.baselined} errors=${summary.errors}`,
  );

  return summary;
}

module.exports = { reconcileEbayInventory };
