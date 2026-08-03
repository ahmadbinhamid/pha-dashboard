// scripts/migrateInventorySettingsToPerTenant.js
//
// One-off: InventorySettings used to be a single global singleton document
// (`key: "global"`, unique-indexed on `key`) shared by every tenant — one
// tenant's low_stock_threshold/notification settings silently applied to
// every other tenant too, since there was only ever one document in the
// whole collection. The model is now one document per tenant instead (see
// models/InventorySettings.js), keyed by tenant_id.
//
// This assigns the pre-existing global doc's REAL configured values (not
// schema defaults) to the tenant passed in, and drops the old `key` field
// and its unique index. Idempotent: a second run is a no-op if the global
// doc is already gone.
//
// Usage: node scripts/migrateInventorySettingsToPerTenant.js <tenantId>
//
// BACK UP THE DATABASE BEFORE RUNNING THIS AGAINST PRODUCTION.

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

async function run() {
  const tenantIdArg = process.argv[2];
  if (!tenantIdArg || !mongoose.isValidObjectId(tenantIdArg)) {
    console.error("Usage: node scripts/migrateInventorySettingsToPerTenant.js <tenantId>");
    process.exit(1);
  }
  const tenantObjectId = new mongoose.Types.ObjectId(tenantIdArg);

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB — migrating InventorySettings to tenant_id = ${tenantIdArg}`);
  const coll = mongoose.connection.db.collection("inventorysettings");

  const globalDoc = await coll.findOne({ key: "global" });
  if (!globalDoc) {
    console.log("No global singleton doc found — already migrated (or never existed). Nothing to do.");
  } else {
    const alreadyForThisTenant = await coll.findOne({ tenant_id: tenantObjectId });
    if (alreadyForThisTenant && String(alreadyForThisTenant._id) !== String(globalDoc._id)) {
      console.error(
        `A separate InventorySettings doc already exists for tenant ${tenantIdArg} ` +
          `(likely auto-created by a getOrCreate() call before this migration ran). ` +
          `Resolve manually — decide which values (global doc's real settings vs. ` +
          `the auto-created defaults) should win, then remove the loser.`,
      );
      process.exit(1);
    }

    await coll.updateOne(
      { _id: globalDoc._id },
      { $set: { tenant_id: tenantObjectId }, $unset: { key: "" } },
    );
    console.log(`Migrated global settings doc ${globalDoc._id} -> tenant_id ${tenantIdArg}`);
  }

  const indexes = await coll.indexes();
  if (indexes.some((i) => i.name === "key_1")) {
    await coll.dropIndex("key_1");
    console.log("Dropped stale key_1 index.");
  } else {
    console.log("key_1 index already gone.");
  }

  console.log("Done. Run scripts/syncIndexes.js next to create the new tenant_id unique index.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("migrateInventorySettingsToPerTenant failed:", err);
  process.exit(1);
});
