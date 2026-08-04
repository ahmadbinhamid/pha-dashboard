// scripts/auditCrossTenantInventory.js
//
// One-off audit + cleanup for the cross-tenant Inventory leak fixed in
// product.service.js#ensureInventoryForProduct (was querying
// Location.find({ is_active: true }) with no tenant filter, so creating or
// editing any stock-controlled product created an Inventory row for it at
// EVERY tenant's locations, not just the owning tenant's).
//
// This finds Inventory records whose product and location belong to
// DIFFERENT tenants — i.e. exactly the phantom rows that bug could have
// created before the fix. Dry run by default; --write deletes them.
//
// A mismatched row with stock_count/stock_reserved > 0 is flagged but never
// auto-deleted even with --write — that would mean something actually wrote
// real stock to a leaked record, which needs a human look before removal,
// not a script deciding for you.
//
// Usage:
//   node scripts/auditCrossTenantInventory.js            # dry run
//   node scripts/auditCrossTenantInventory.js --write     # delete zero-stock leaks

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

const WRITE = process.argv.includes("--write");

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}`);
  const db = mongoose.connection.db;

  const mismatched = await db
    .collection("inventories")
    .aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "locations",
          localField: "location",
          foreignField: "_id",
          as: "location",
        },
      },
      { $unwind: "$location" },
      {
        $match: {
          $expr: { $ne: ["$product.tenant_id", "$location.tenant_id"] },
        },
      },
      {
        $project: {
          product_id: "$product._id",
          product_title: "$product.title",
          product_tenant_id: "$product.tenant_id",
          location_id: "$location._id",
          location_name: "$location.name",
          location_tenant_id: "$location.tenant_id",
          stock_count: 1,
          stock_reserved: 1,
        },
      },
    ])
    .toArray();

  console.log(`\nInventory records with mismatched product/location tenants: ${mismatched.length}`);

  if (mismatched.length === 0) {
    console.log("Nothing to clean up.");
    await mongoose.disconnect();
    return;
  }

  const zeroStock = mismatched.filter((r) => !r.stock_count && !r.stock_reserved);
  const nonZeroStock = mismatched.filter((r) => r.stock_count || r.stock_reserved);

  console.log(`  - zero stock_count/stock_reserved (safe phantom rows): ${zeroStock.length}`);
  console.log(`  - NON-zero stock_count/stock_reserved (needs a human look, never auto-deleted): ${nonZeroStock.length}`);

  if (nonZeroStock.length > 0) {
    console.log("\nNon-zero mismatched records:");
    console.log(JSON.stringify(nonZeroStock, null, 2));
  }

  if (zeroStock.length > 0) {
    console.log("\nSample of zero-stock mismatched records (up to 10):");
    console.log(JSON.stringify(zeroStock.slice(0, 10), null, 2));
  }

  if (WRITE && zeroStock.length > 0) {
    const ids = zeroStock.map((r) => r._id);
    const result = await db.collection("inventories").deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} zero-stock leaked Inventory records.`);
  } else if (!WRITE && zeroStock.length > 0) {
    console.log("\nDry run only — nothing deleted. Re-run with --write to remove the zero-stock leaked records.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
