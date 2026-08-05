// scripts/backfillOrderNumberPrefix.js
//
// One-off: stamps order_number_prefix: "ORD" and invoice_number_prefix:
// "INV" onto every existing Order that predates those fields (see Order.js/
// Tenant.js — added to support per-tenant configurable prefixes, snapshotted
// per-order at creation time). The Mongoose schema `default` already covers
// this for anything read through Mongoose, but this makes it a real,
// physical value in the DB — needed for raw-driver reads (dashboard
// aggregations, other backfill/migration scripts) and so it isn't silently
// relying on runtime defaults forever.
//
// Idempotent — only touches docs missing the field, safe to re-run.
//
// Usage:
//   node scripts/backfillOrderNumberPrefix.js            # dry run
//   node scripts/backfillOrderNumberPrefix.js --write     # apply

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

const WRITE = process.argv.includes("--write");

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}`);
  const db = mongoose.connection.db;
  const orders = db.collection("orders");

  const missingOrderPrefix = await orders.countDocuments({ order_number_prefix: { $exists: false } });
  const missingInvoicePrefix = await orders.countDocuments({ invoice_number_prefix: { $exists: false } });
  console.log(`Orders missing order_number_prefix: ${missingOrderPrefix}`);
  console.log(`Orders missing invoice_number_prefix: ${missingInvoicePrefix}`);

  if (WRITE) {
    const r1 = await orders.updateMany(
      { order_number_prefix: { $exists: false } },
      { $set: { order_number_prefix: "ORD" } },
    );
    const r2 = await orders.updateMany(
      { invoice_number_prefix: { $exists: false } },
      { $set: { invoice_number_prefix: "INV" } },
    );
    console.log(`Set order_number_prefix on ${r1.modifiedCount} order(s)`);
    console.log(`Set invoice_number_prefix on ${r2.modifiedCount} order(s)`);
  } else {
    console.log("\nDry run only — nothing was written. Re-run with --write to apply.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("backfillOrderNumberPrefix failed:", err);
  process.exit(1);
});
