// scripts/consolidateOrdersToEbayOnly.js
//
// Per tenant:
//   1. Deletes every Order whose channel is NOT "ebay" (manual, storefront,
//      or a missing/null channel), plus their Payment and Refund documents
//      (the only two collections that reference Order — see `ref: "Order"`
//      across server/src/models). Does NOT touch Inventory/InventoryHistory
//      — stock counts are left exactly as they are, deliberately, per the
//      call made when this script was written; deleted orders' stock
//      deductions are NOT reversed.
//   2. Renumbers the remaining (now exclusively eBay) orders' order_number
//      as "ORD-00001", "ORD-00002", ... and invoice_number as "INV-00001",
//      "INV-00002", ... in created_at order (oldest first), then advances
//      each tenant's order_number/invoice_number Counter to match, so the
//      next real order created continues the sequence instead of colliding.
//
// THIS DELETES REAL DATA AND IS NOT REVERSIBLE. BACK UP THE DATABASE FIRST,
// especially before running --write against production.
//
// Usage:
//   node scripts/consolidateOrdersToEbayOnly.js            # dry run
//   node scripts/consolidateOrdersToEbayOnly.js --write     # apply

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const { tenantCounterKey } = require("../src/utils/tenantCounterKey");

const WRITE = process.argv.includes("--write");

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}`);
  const db = mongoose.connection.db;

  const tenants = await db.collection("orders").distinct("tenant_id");
  console.log(`Tenants with at least one order: ${tenants.length}`);

  for (const tenantId of tenants) {
    console.log(`\n── Tenant ${tenantId}`);

    const nonEbayIds = await db.collection("orders").distinct("_id", { tenant_id: tenantId, channel: { $ne: "ebay" } });
    const paymentCount = await db.collection("payments").countDocuments({ order: { $in: nonEbayIds } });
    const refundCount = await db.collection("refunds").countDocuments({ order: { $in: nonEbayIds } });
    const survivingCount = await db.collection("orders").countDocuments({ tenant_id: tenantId, channel: "ebay" });

    console.log(`  Deleting: ${nonEbayIds.length} non-eBay order(s), ${paymentCount} payment(s), ${refundCount} refund(s)`);
    console.log(`  Surviving: ${survivingCount} eBay order(s) — will be renumbered ORD-00001.. / INV-00001..`);

    if (WRITE) {
      if (nonEbayIds.length > 0) {
        await db.collection("payments").deleteMany({ order: { $in: nonEbayIds } });
        await db.collection("refunds").deleteMany({ order: { $in: nonEbayIds } });
        await db.collection("orders").deleteMany({ _id: { $in: nonEbayIds } });
      }
    }

    // Renumber whatever's left for this tenant (only reachable meaningfully
    // in --write mode, since in dry-run nothing was actually deleted yet —
    // report what WOULD be renumbered using the same "channel: ebay" set).
    const surviving = await db.collection("orders")
      .find({ tenant_id: tenantId, channel: "ebay" })
      .sort({ created_at: 1 })
      .toArray();

    let seq = 0;
    for (const order of surviving) {
      seq++;
      const order_number = `ORD-${String(seq).padStart(5, "0")}`;
      const invoice_number = `INV-${String(seq).padStart(5, "0")}`;
      if (order.order_number !== order_number || order.invoice_number !== invoice_number) {
        if (WRITE) {
          await db.collection("orders").updateOne({ _id: order._id }, { $set: { order_number, invoice_number } });
        }
      }
    }
    console.log(`  Renumbered ${surviving.length} surviving order(s) 1..${seq}`);

    if (WRITE && seq > 0) {
      await db.collection("counters").updateOne(
        { _id: tenantCounterKey(tenantId, "order_number") },
        { $set: { seq } },
        { upsert: true },
      );
      await db.collection("counters").updateOne(
        { _id: tenantCounterKey(tenantId, "invoice_number") },
        { $set: { seq } },
        { upsert: true },
      );
      console.log(`  Counters advanced to ${seq} — next new order continues from ORD-${String(seq + 1).padStart(5, "0")}`);
    }
  }

  if (!WRITE) {
    console.log("\nDry run only — nothing was written. Re-run with --write to apply.");
  } else {
    console.log("\nDone.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("consolidateOrdersToEbayOnly failed:", err);
  process.exit(1);
});
