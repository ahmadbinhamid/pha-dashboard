// scripts/backfillTenantId.js
//
// One-off: assigns every pre-existing document across every tenant-scoped
// collection to the tenant created by provisionInitialTenant.js. Run that
// script FIRST and pass its printed _id here.
//
// Usage: node scripts/backfillTenantId.js <tenantId>
//
// Idempotent/resumable (same pattern as migrateInvoiceNumbers.js): each
// collection's bulkWrite only touches docs where tenant_id doesn't already
// exist, so re-running after a partial failure only picks up where it left
// off. Exits non-zero (without proceeding to the required:true/compound-index
// deploy) if any collection still has docs missing tenant_id afterward.
//
// BACK UP THE DATABASE BEFORE RUNNING THIS AGAINST PRODUCTION.

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

const COLLECTIONS = [
  "users",
  "orders",
  "products",
  "productvariants",
  "customers",
  "payments",
  "refunds",
  "categories",
  "marketplacelistings",
  // Missed in the original migration — Location had no tenant_id field at
  // all until it was added alongside this entry. Found live via a real
  // second tenant seeing every location (and, transitively, every
  // Inventory record referencing one) belonging to the first tenant.
  "locations",
  // Same gap — every tenant's uploaded files (product photos, etc.) sat in
  // one shared collection with no ownership check on delete.
  "attachments",
];

// Order.order_number/invoice_number and Refund.refund_number counters were
// keyed by a bare "order_number"/"invoice_number"/"refund_number" _id before
// multi-tenancy — remap each to this tenant's namespaced key
// (`${tenantId}:order_number`) so numbering continues from where it left off
// instead of restarting at 1 under the new key.
const COUNTER_KEYS = ["order_number", "invoice_number", "refund_number"];

async function backfillCollection(db, tenantObjectId, name) {
  const collection = db.collection(name);
  const missing = await collection.countDocuments({ tenant_id: { $exists: false } });
  if (missing === 0) {
    console.log(`[${name}] nothing to backfill`);
    return;
  }

  const result = await collection.updateMany(
    { tenant_id: { $exists: false } },
    { $set: { tenant_id: tenantObjectId } },
  );
  console.log(`[${name}] backfilled ${result.modifiedCount} / ${missing}`);
}

async function remapCounters(db, tenantId) {
  const counters = db.collection("counters");
  for (const key of COUNTER_KEYS) {
    const old = await counters.findOne({ _id: key });
    if (!old) continue;
    const newId = `${tenantId}:${key}`;
    const existing = await counters.findOne({ _id: newId });
    if (existing) {
      console.log(`[counters] ${newId} already exists — skipping remap of "${key}"`);
      continue;
    }
    await counters.insertOne({ _id: newId, seq: old.seq });
    await counters.deleteOne({ _id: key });
    console.log(`[counters] remapped "${key}" (seq ${old.seq}) -> "${newId}"`);
  }
}

async function verify(db, tenantObjectId) {
  let allClean = true;
  for (const name of COLLECTIONS) {
    const stillMissing = await db.collection(name).countDocuments({ tenant_id: { $exists: false } });
    if (stillMissing > 0) {
      allClean = false;
      console.error(`[${name}] VERIFY FAILED: ${stillMissing} docs still missing tenant_id`);
    } else {
      console.log(`[${name}] verified: 0 docs missing tenant_id`);
    }
  }
  return allClean;
}

async function run() {
  const tenantIdArg = process.argv[2];
  if (!tenantIdArg || !mongoose.isValidObjectId(tenantIdArg)) {
    console.error("Usage: node scripts/backfillTenantId.js <tenantId>");
    process.exit(1);
  }
  const tenantObjectId = new mongoose.Types.ObjectId(tenantIdArg);

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB — backfilling tenant_id = ${tenantIdArg}`);
  const db = mongoose.connection.db;

  for (const name of COLLECTIONS) {
    await backfillCollection(db, tenantObjectId, name);
  }
  await remapCounters(db, tenantIdArg);

  const clean = await verify(db, tenantObjectId);
  await mongoose.disconnect();

  if (!clean) {
    console.error("\nBackfill incomplete — do NOT deploy the required:true/compound-index migration yet.");
    process.exit(1);
  }
  console.log("\nBackfill verified clean. Safe to deploy the required:true + compound-index follow-up.");
}

run().catch((err) => {
  console.error("backfillTenantId failed:", err);
  process.exit(1);
});
