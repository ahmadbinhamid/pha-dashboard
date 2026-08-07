// scripts/backfillEbaySyncBaseline.js
//
// One-time backfill for MarketplaceListing.ebay_synced_quantity — needed
// because that field's meaning changed: it used to sometimes get stamped
// from LOCAL stock (see inventory.service.js#adjustStockBySku's comment),
// which is "our expected eBay quantity", not "an eBay-confirmed value".
// Existing listings may be sitting on a baseline that was never actually
// verified against eBay. This reads each eBay-enabled tenant's LIVE
// quantities and writes the baseline from THAT — the one time this field is
// allowed to be seeded from something other than a push we made ourselves.
//
// Also nulls ebay_pending_reconcile_qty everywhere, so no listing carries a
// half-confirmed drift observation left over from before this backfill.
//
// A tenant whose getAllInventoryItems() fetch comes back incomplete
// (complete: false — see ebay.api.service.js) is skipped entirely for the
// per-listing backfill, logged, and left for a re-run — better to leave a
// stale baseline in place than seed one from a fetch that might be missing
// SKUs.
//
// Usage:
//   node scripts/backfillEbaySyncBaseline.js [--dry-run]

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
require("../src/models/index"); // register all schemas before any populate() calls
const MarketplaceListing = require("../src/models/MarketplaceListing");
const ebayApi = require("../src/services/ebay/ebay.api.service");
const ebayTenant = require("../src/services/ebay/ebay.tenant");
const { resolveSku } = require("../src/services/marketplace/listing.resolver");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../src/constants/marketplace.constants");

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillTenant(tenant, settings) {
  const { items, complete } = await ebayApi.getAllInventoryItems(settings);
  if (!complete) {
    console.warn(`  [SKIPPED] tenant ${tenant._id}: getAllInventoryItems returned an incomplete page set — re-run later`);
    return { updated: 0, skipped: true };
  }

  const ebayQtyBySku = new Map();
  for (const item of items) {
    const qty = item.availability?.shipToLocationAvailability?.quantity;
    if (item.sku && qty != null) ebayQtyBySku.set(item.sku, qty);
  }

  const listings = await MarketplaceListing.find({
    tenant_id: tenant._id,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    deleted_at: null,
  })
    .populate("product")
    .populate("variant");

  let updated = 0;
  for (const listing of listings) {
    if (!listing.product) continue;
    const sku = resolveSku(listing, listing.product, listing.variant);
    const ebayQty = ebayQtyBySku.get(sku);
    if (ebayQty == null) continue; // not found on eBay right now — leave alone, not this script's job to guess

    console.log(
      `  ${DRY_RUN ? "[DRY RUN] would set" : "  setting"} SKU ${sku} (listing ${listing._id}): ` +
        `ebay_synced_quantity ${listing.ebay_synced_quantity} -> ${ebayQty}`,
    );

    if (!DRY_RUN) {
      await MarketplaceListing.updateOne(
        { _id: listing._id, tenant_id: tenant._id },
        { $set: { ebay_synced_quantity: ebayQty, ebay_synced_at: new Date(), ebay_pending_reconcile_qty: null } },
        // eBay-discriminator-only fields — see ebay.adapter.js#updateSyncBaseline's comment.
        { strict: false },
      );
    }
    updated++;
  }

  return { updated, skipped: false };
}

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB${DRY_RUN ? " (--dry-run: no writes will be made)" : ""}`);

  const configured = await ebayTenant.getConfiguredTenants();
  if (!configured.length) {
    console.log("No tenants have eBay configured — nothing to do");
    await mongoose.disconnect();
    return;
  }

  console.log(`Backfilling ${configured.length} eBay-enabled tenant(s)...`);
  let totalUpdated = 0;
  const skippedTenants = [];

  for (const { tenant, settings } of configured) {
    console.log(`Tenant ${tenant._id} (${tenant.name || tenant.company_name || "unnamed"}):`);
    try {
      const { updated, skipped } = await backfillTenant(tenant, settings);
      if (skipped) skippedTenants.push(tenant._id.toString());
      totalUpdated += updated;
      console.log(`  ${updated} listing(s) ${DRY_RUN ? "would be" : ""} updated`);
    } catch (err) {
      console.error(`  [ERROR] tenant ${tenant._id}: ${err.message}`);
      skippedTenants.push(tenant._id.toString());
    }
  }

  if (!DRY_RUN) {
    const clearResult = await MarketplaceListing.updateMany(
      { ebay_pending_reconcile_qty: { $ne: null } },
      { $set: { ebay_pending_reconcile_qty: null } },
      { strict: false },
    );
    console.log(`Cleared ebay_pending_reconcile_qty on ${clearResult.modifiedCount} listing(s) globally`);
  } else {
    const wouldClear = await MarketplaceListing.countDocuments({ ebay_pending_reconcile_qty: { $ne: null } });
    console.log(`[DRY RUN] would clear ebay_pending_reconcile_qty on ${wouldClear} listing(s) globally`);
  }

  console.log(`\nDone — ${totalUpdated} listing(s) ${DRY_RUN ? "would be" : ""} backfilled.`);
  if (skippedTenants.length) {
    console.log(`Skipped tenant(s) (incomplete fetch or error, re-run later): ${skippedTenants.join(", ")}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("backfillEbaySyncBaseline failed:", err);
  process.exit(1);
});
