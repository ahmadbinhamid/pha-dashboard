/**
 * Phase D migration: backfill `platform` field on EbayProcessedOrder documents
 * and rebuild the unique index from {orderId, action} → {platform, orderId, action}.
 *
 * Usage:
 *   DRY_RUN=true  node server/scripts/addPlatformToProcessedOrders.js
 *   DRY_RUN=false node server/scripts/addPlatformToProcessedOrders.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const DRY_RUN = process.env.DRY_RUN !== "false";
const PLATFORM_VALUE = "ebay";
const COLLECTION = "ebayprocessedorders";

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(`[Phase D] addPlatformToProcessedOrders — DRY_RUN=${DRY_RUN}`);

  const col = mongoose.connection.db.collection(COLLECTION);

  const missingCount = await col.countDocuments({ platform: { $exists: false } });
  const totalCount = await col.countDocuments();

  console.log(`\nTotal EbayProcessedOrder documents: ${totalCount}`);
  console.log(`Documents missing platform field:    ${missingCount}`);

  const existingIndexes = await col.indexes();
  const oldIndexExists = existingIndexes.some(
    (idx) => idx.key && idx.key.orderId && idx.key.action && !idx.key.platform,
  );
  const newIndexExists = existingIndexes.some(
    (idx) => idx.key && idx.key.platform && idx.key.orderId && idx.key.action,
  );

  console.log(`\nOld index {orderId, action} present: ${oldIndexExists}`);
  console.log(`New index {platform, orderId, action} present: ${newIndexExists}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes written. Re-run with DRY_RUN=false to apply.");
    await mongoose.disconnect();
    return;
  }

  // ── Step 1: backfill platform ─────────────────────────────────────────────
  if (missingCount > 0) {
    const result = await col.updateMany(
      { platform: { $exists: false } },
      { $set: { platform: PLATFORM_VALUE } },
    );
    console.log(`\nBackfilled platform on ${result.modifiedCount} documents`);
  } else {
    console.log("\nNo documents to backfill");
  }

  // ── Step 2: drop old index, create new one ────────────────────────────────
  if (oldIndexExists) {
    await col.dropIndex({ orderId: 1, action: 1 });
    console.log("Dropped old index {orderId, action}");
  }

  if (!newIndexExists) {
    await col.createIndex({ platform: 1, orderId: 1, action: 1 }, { unique: true });
    console.log("Created new index {platform, orderId, action}");
  }

  console.log("\n[Phase D] Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
