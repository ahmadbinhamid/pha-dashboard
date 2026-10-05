// services/inventoryTenantBackfill.service.js
// Sets Inventory/InventoryHistory tenant_id from the product; idempotent.

const { Types } = require("mongoose");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const Product = require("../models/Product");

const CHUNK_SIZE = 500;
const ORPHAN_SAMPLE = 20;

// NOTE: soft-deleted products still own their stock rows, so they count.
async function productTenants(productIds) {
  const products = await Product.find({ _id: { $in: productIds } })
    .setOptions({ withDeleted: true })
    .select("tenant_id")
    .lean();
  return new Map(products.map((p) => [String(p._id), p.tenant_id]));
}

// Pages by _id so it never re-reads a row, written or not.
async function backfillModel(Model, { tenantId, confirm }) {
  const result = { missing: 0, updated: 0, wouldUpdate: 0, orphans: 0, orphanSample: [], byTenant: {} };
  let lastId = null;
  for (;;) {
    const rows = await Model.find({ tenant_id: null, ...(lastId ? { _id: { $gt: lastId } } : {}) })
      .sort({ _id: 1 })
      .limit(CHUNK_SIZE)
      .select("_id product")
      .lean();
    if (!rows.length) break;
    lastId = rows[rows.length - 1]._id;
    result.missing += rows.length;

    const tenantByProduct = await productTenants([...new Set(rows.map((r) => String(r.product)))]);
    const ops = [];
    for (const row of rows) {
      const owner = tenantByProduct.get(String(row.product));
      if (!owner) {
        result.orphans++;
        if (result.orphanSample.length < ORPHAN_SAMPLE) result.orphanSample.push({ _id: String(row._id), product: String(row.product) });
        continue;
      }
      if (tenantId && String(owner) !== String(tenantId)) continue;
      result.byTenant[owner] = (result.byTenant[owner] ?? 0) + 1;
      ops.push({ updateOne: { filter: { _id: row._id, tenant_id: null }, update: { $set: { tenant_id: owner } } } });
    }
    result.wouldUpdate += ops.length;
    if (confirm && ops.length) result.updated += (await Model.bulkWrite(ops, { ordered: false })).modifiedCount;
  }
  return result;
}

/** Dry-run unless confirm; --tenant limits writes to that tenant's rows. */
async function backfillInventoryTenantId({ tenantId = null, confirm = false } = {}) {
  const scope = { tenantId: tenantId ? new Types.ObjectId(String(tenantId)) : null, confirm };
  return {
    inventories: await backfillModel(Inventory, scope),
    inventoryhistories: await backfillModel(InventoryHistory, scope),
  };
}

module.exports = { backfillInventoryTenantId };
