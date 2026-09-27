// services/pendingReconciliation.service.js
// CRUD + resolution for PendingReconciliation rows, the human-review queue the eBay inventory-sync
// poller writes to instead of auto-adjusting stock. See models/PendingReconciliation.js for why.

const PendingReconciliation = require("../models/PendingReconciliation");
const MarketplaceListing = require("../models/MarketplaceListing");
const { adjustStockForSku, fanOutMarketplaceInventory } = require("./inventory.service");
const { logger } = require("../loaders/logging");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

// Upserts the single open "pending" row for this listing; a second poll seeing the same drift
// just refreshes last_seen_at (the model's partial unique index also enforces this).
async function upsertPending({ tenantId, listingId, sku, localQty, ebayQty }) {
  const delta = ebayQty - localQty;
  return PendingReconciliation.findOneAndUpdate(
    { tenant_id: tenantId, listing: listingId, status: "pending" },
    {
      $set: { sku, local_qty: localQty, ebay_qty: ebayQty, delta, last_seen_at: new Date() },
      $setOnInsert: { first_seen_at: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function listPending(tenantId) {
  return PendingReconciliation.find({ tenant_id: tenantId, status: "pending" })
    .populate({ path: "listing", select: "product variant platform" })
    .sort({ last_seen_at: -1 });
}

async function findPendingById(id, tenantId) {
  return PendingReconciliation.findOne({ _id: id, tenant_id: tenantId, status: "pending" });
}

// Applies eBay's reported quantity to local stock. skipMarketplaceFanOut: true since eBay is
// the side that changed — pushing here would just re-announce eBay's own number back to itself.
async function acceptReconciliation(id, tenantId, userId) {
  const row = await findPendingById(id, tenantId);
  if (!row) return null;

  await adjustStockForSku(row.sku, row.delta, {
    reason: `Reconciliation accepted: eBay quantity changed directly on eBay (was ${row.local_qty}, now ${row.ebay_qty})`,
    type: ADJUSTMENT_TYPE.EBAY_MANUAL_ADJUSTMENT,
    userId,
    tenantId,
    skipMarketplaceFanOut: true,
  });

  await MarketplaceListing.updateOne(
    { _id: row.listing, tenant_id: tenantId },
    {
      $set: {
        // TODO(dual-write): remove ebay_synced_quantity after backfill; synced_quantity replaces it.
        ebay_synced_quantity: row.ebay_qty,
        ebay_synced_at: new Date(),
        ebay_pending_reconcile_qty: null,
        synced_quantity: row.ebay_qty,
        synced_at: new Date(),
      },
    },
    // strict: false, since these are eBay-discriminator-only fields a base-model update would drop.
    { strict: false },
  );

  row.status = "accepted";
  row.resolved_by = userId;
  row.resolved_at = new Date();
  await row.save();
  return row;
}

// Merchant says eBay's number is wrong — push local stock back to eBay to overwrite it.
async function rejectReconciliation(id, tenantId, userId) {
  const row = await findPendingById(id, tenantId);
  if (!row) return null;

  row.status = "rejected";
  row.resolved_by = userId;
  row.resolved_at = new Date();
  await row.save();

  try {
    // Goes through fanOutMarketplaceInventory so this re-push is fenced like every other push.
    const listing = await MarketplaceListing.findOne({ _id: row.listing, tenant_id: tenantId }).select("product variant");
    if (listing) {
      await fanOutMarketplaceInventory(listing.product, listing.variant, tenantId);
    }
  } catch (err) {
    logger.warn(`[pendingReconciliation.service] failed to enqueue re-push for rejected reconciliation ${id}: ${err.message}`);
  }

  return row;
}

module.exports = { upsertPending, listPending, findPendingById, acceptReconciliation, rejectReconciliation };
