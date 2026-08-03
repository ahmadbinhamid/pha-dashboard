// scripts/checkCounterDrift.js
//
// Order/invoice/refund numbers are minted from a per-tenant Counter doc
// (`${tenantId}:order_number` etc — see utils/tenantCounterKey.js). Before
// tenant-scoping existed, these were minted from a bare, unnamespaced key
// (e.g. "order_number") — found live: on this project's own dev DB, the
// tenant-namespaced counter was left frozen at an old checkpoint from
// migration time while real orders kept climbing on the old unnamespaced
// key, so the very next order created after using the tenant-scoped
// counter collided (E11000) with an order number that already existed.
//
// This checks every tenant with real orders/refunds for the same drift —
// counter.seq behind the real max — and by default only REPORTS it. Pass
// --fix to actually correct any drift found (sets seq to the real max,
// never lower, so it's always safe to run against a healthy DB too).
//
// Usage:
//   node scripts/checkCounterDrift.js            # report only
//   node scripts/checkCounterDrift.js --fix      # report and correct

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Order = require("../src/models/Order");
const Refund = require("../src/models/Refund");
const Counter = require("../src/models/Counter");

function parseNumericSuffix(value) {
  if (!value) return null;
  const match = String(value).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function run() {
  const shouldFix = process.argv.includes("--fix");

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB — ${shouldFix ? "checking and fixing" : "checking only (pass --fix to correct)"} counter drift`);

  const tenantIds = await Order.distinct("tenant_id");
  let anyDrift = false;

  for (const tenantId of tenantIds) {
    const checks = [
      {
        name: "order_number",
        max: await Order.find({ tenant_id: tenantId }).sort({ order_number: -1 }).limit(1).select("order_number").then((r) => parseNumericSuffix(r[0]?.order_number)),
      },
      {
        name: "invoice_number",
        max: await Order.find({ tenant_id: tenantId }).sort({ invoice_number: -1 }).limit(1).select("invoice_number").then((r) => parseNumericSuffix(r[0]?.invoice_number)),
      },
      {
        name: "refund_number",
        max: await Refund.find({ tenant_id: tenantId }).sort({ refund_number: -1 }).limit(1).select("refund_number").then((r) => parseNumericSuffix(r[0]?.refund_number)),
      },
    ];

    for (const { name, max } of checks) {
      if (max == null) continue; // no documents of this type for this tenant yet
      const key = `${tenantId}:${name}`;
      const counter = await Counter.findById(key);
      const seq = counter?.seq ?? 0;

      if (seq < max) {
        anyDrift = true;
        console.warn(`[DRIFT] ${key}: counter at ${seq}, real max is ${max}`);
        if (shouldFix) {
          await Counter.findOneAndUpdate({ _id: key }, { $set: { seq: max } }, { upsert: true });
          console.log(`  -> fixed: ${key} set to ${max}`);
        }
      } else {
        console.log(`[OK] ${key}: counter at ${seq}, real max is ${max}`);
      }
    }
  }

  if (anyDrift && !shouldFix) {
    console.warn("\nDrift found. Re-run with --fix to correct it before it causes a duplicate-key error on the next order/invoice/refund.");
  } else if (!anyDrift) {
    console.log("\nNo drift found.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("checkCounterDrift failed:", err);
  process.exit(1);
});
