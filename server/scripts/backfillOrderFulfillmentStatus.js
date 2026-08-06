// scripts/backfillOrderFulfillmentStatus.js
//
// One-off: remaps Order.fulfillment_status from the old 3-value enum
// (unfulfilled/fulfilled/cancelled) to the current 5-value one
// (pending/processing/on_hold/completed/cancelled) — unfulfilled -> pending,
// fulfilled -> completed, cancelled is unchanged so left alone.
//
// Needed because the Mongoose schema enum no longer contains the old
// values — any order still holding one will fail validation on its next
// .save() until remapped, and deriveLegacyOrderStatus (utils/paymentStatus.js)
// compares against the literal string "completed", so an un-remapped
// "fulfilled" order silently stops being recognized as fulfilled by the
// legacy `status` rollup that dashboard/invoice code still reads.
//
// Idempotent/resumable — re-running only touches docs still on an old value.
//
// Usage: node scripts/backfillOrderFulfillmentStatus.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

const REMAP = {
  unfulfilled: "pending",
  fulfilled: "completed",
};

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const orders = mongoose.connection.db.collection("orders");

  for (const [oldValue, newValue] of Object.entries(REMAP)) {
    const result = await orders.updateMany(
      { fulfillment_status: oldValue },
      { $set: { fulfillment_status: newValue } },
    );
    console.log(`[fulfillment_status] ${oldValue} -> ${newValue}: ${result.modifiedCount} updated`);
  }

  const remaining = await orders.countDocuments({
    fulfillment_status: { $in: Object.keys(REMAP) },
  });

  await mongoose.disconnect();

  if (remaining > 0) {
    console.error(`\n${remaining} order(s) still on an old fulfillment_status value — re-run to pick them up.`);
    process.exit(1);
  }
  console.log("\nBackfill complete — no orders left on the old fulfillment_status values.");
}

run().catch((err) => {
  console.error("backfillOrderFulfillmentStatus failed:", err);
  process.exit(1);
});
