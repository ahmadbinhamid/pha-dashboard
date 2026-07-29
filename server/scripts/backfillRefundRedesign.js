// scripts/backfillRefundRedesign.js
//
// refund-redesign-spec.md §6.2. Three independent steps — run any subset via
// --only, e.g. `--only=itemIds` to re-run just the item-id pass before §5's
// endpoints ship (see step A's own comment for why that has to happen twice).
//
// Usage:
//   node scripts/backfillRefundRedesign.js                # dry run (default)
//   node scripts/backfillRefundRedesign.js --write         # actually write
//   node scripts/backfillRefundRedesign.js --only=itemIds  # one step only
//   node scripts/backfillRefundRedesign.js --write --only=refunds,orderStatus
//
// Raw driver collection access throughout (not the Mongoose models) — same
// pattern as migrateInvoiceNumbers.js — so this never goes through Mongoose
// validation/defaults, which would mask exactly the "is this actually
// persisted" question step A depends on (see Order.js's item_ids_migrated_at
// comment: a hydrated Mongoose document auto-generates an in-memory _id for
// any item missing one, even when nothing was ever saved — reading raw BSON
// via the driver is the only way to see the true persisted shape).

require("dotenv").config();

const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const config = require("../src/config");

const WRITE = process.argv.includes("--write");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
const shouldRun = (step) => !ONLY || ONLY.has(step);

function log(...args) {
  console.log(...args);
}

// ── Step A: per-item _id backfill ──────────────────────────────────────────
//
// orderItemSchema was `{ _id: false }` before refund-redesign-spec.md §1.1.
// Two things make this NOT a simple "for every order missing item ids,
// assign them all" pass:
//
//   1. Normal traffic already persists item _ids incrementally, one order at
//      a time, as a side effect of any code path that loads an order and
//      saves it again (syncOrderStock mutating item.ebay_sync_status then
//      order.save(), updateOrderItemPrice, handlePaymentSucceeded, ...).
//      Verified directly against this DB: PHA-00001 — untouched since long
//      before this change — already reads back with a live item._id the
//      moment it's loaded through Mongoose (auto-generated in memory), but
//      that's NOT the same as it being persisted; a raw driver read of the
//      same order shows the field genuinely absent. Whether a *specific*
//      order has been re-saved since Phase 1 shipped is not knowable in
//      advance — hence the raw read here, not a Mongoose hydrate.
//   2. Because of (1), a single order can have SOME items with a real
//      persisted _id (touched by traffic) and others without (untouched) —
//      a per-order "does this order look migrated" heuristic mishandles
//      that mixed case. This has to check and assign per ITEM, not per
//      order, and must never overwrite an _id that's already there.
//
// Each item gets its own conditional update (`items.<i>._id` must still not
// exist at write time) so a concurrent order.save() from live traffic between
// this script's read and its write can't be clobbered — whichever writes
// second simply finds nothing left to do for that slot.
//
// Re-running this is not a one-time thing: run it again immediately before
// Phase 5 ships (whenever that is), since traffic between Phase 2 and Phase
// 5 keeps persisting more item ids the same way, and or der_ids_migrated_at
// only gets set once ALL of an order's items are confirmed persisted.
async function backfillItemIds(db, { write }) {
  log("\n=== Step A: item _id backfill ===");
  const orders = db.collection("orders");

  const cursor = orders.find(
    {},
    { projection: { items: 1, item_ids_migrated_at: 1, order_number: 1 } },
  );

  let ordersScanned = 0;
  let ordersWithGaps = 0;
  let itemsAssigned = 0;
  let ordersNewlyMarkedMigrated = 0;
  const sampleOrders = [];

  while (await cursor.hasNext()) {
    const order = await cursor.next();
    ordersScanned++;

    const items = order.items || [];
    const missingIndexes = items
      .map((item, i) => (item && item._id == null ? i : null))
      .filter((i) => i !== null);

    if (missingIndexes.length === 0) {
      // Every item already has a persisted _id (either from an earlier run
      // of this script, or from live traffic) — just make sure the flag
      // reflects that, in case this order was never explicitly stamped.
      if (!order.item_ids_migrated_at) {
        ordersNewlyMarkedMigrated++;
        if (write) {
          await orders.updateOne(
            { _id: order._id },
            { $set: { item_ids_migrated_at: new Date() } },
          );
        }
      }
      continue;
    }

    ordersWithGaps++;
    itemsAssigned += missingIndexes.length;
    if (sampleOrders.length < 10) {
      sampleOrders.push({ order_number: order.order_number, missing_item_indexes: missingIndexes });
    }

    if (write) {
      for (const i of missingIndexes) {
        // Conditional filter — only writes if this exact slot is STILL
        // missing an _id right now, not just when we first read it above.
        await orders.updateOne(
          { _id: order._id, [`items.${i}._id`]: { $exists: false } },
          { $set: { [`items.${i}._id`]: new ObjectId() } },
        );
      }
      // Re-read (not trust our stale in-memory copy) before stamping the
      // flag — a concurrent write could have added an item, or another
      // process could be running this same script at the same time.
      const fresh = await orders.findOne({ _id: order._id }, { projection: { items: 1 } });
      const stillMissing = (fresh.items || []).some((item) => item && item._id == null);
      if (!stillMissing) {
        await orders.updateOne({ _id: order._id }, { $set: { item_ids_migrated_at: new Date() } });
        ordersNewlyMarkedMigrated++;
      }
    }
  }

  log(`Orders scanned: ${ordersScanned}`);
  log(`Orders with at least one item missing a persisted _id: ${ordersWithGaps}`);
  log(`Item slots that ${write ? "were" : "would be"} assigned a new _id: ${itemsAssigned}`);
  log(`Orders ${write ? "newly marked" : "that would be marked"} item_ids_migrated_at: ${ordersNewlyMarkedMigrated}`);
  if (sampleOrders.length) {
    log("Sample (up to 10):", JSON.stringify(sampleOrders, null, 2));
  }
}

// ── Step B: Refund backfill to the new shape ────────────────────────────────
//
// Only touches refunds that don't have `scope` set yet — that's the "have I
// already been processed" signal (unlike item ids, refund_number is minted
// once and must never be reassigned, so skipping on `scope` rather than on
// `refund_number` keeps this idempotent without burning extra Counter values
// on a refund that already has one for some other reason).
async function backfillRefunds(db, { write }) {
  log("\n=== Step B: Refund → new shape backfill ===");
  const refunds = db.collection("refunds");
  const payments = db.collection("payments");
  const counters = db.collection("counters");

  const toMigrate = await refunds.find({ scope: { $exists: false } }).toArray();
  log(`Refunds needing backfill: ${toMigrate.length}`);
  if (!toMigrate.length) return;

  // Seed the counter from whatever CN-##### numbers already exist (e.g. from
  // an earlier partial run of this same script) — the atomic $inc below
  // would otherwise start back at 1 and collide with numbers already
  // persisted on refunds this step already migrated before a prior crash.
  if (write) {
    const existingNumbered = await refunds
      .find({ refund_number: { $exists: true } }, { projection: { refund_number: 1 } })
      .toArray();
    const highestSeq = existingNumbered.reduce((max, r) => {
      const n = parseInt(String(r.refund_number).replace(/^CN-/, ""), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const counter = await counters.findOne({ _id: "refund_number" });
    if (!counter || counter.seq < highestSeq) {
      await counters.updateOne({ _id: "refund_number" }, { $set: { seq: highestSeq } }, { upsert: true });
      log(`Seeded "refund_number" counter to ${highestSeq} (from existing refund_number values)`);
    }
  }

  // Batch-fetch every referenced Payment once, rather than one lookup per
  // refund — small collection here, but no reason to N+1 a script either.
  const paymentIds = [...new Set(toMigrate.map((r) => String(r.payment)))].map((id) => new ObjectId(id));
  const paymentDocs = await payments.find({ _id: { $in: paymentIds } }).toArray();
  const paymentById = new Map(paymentDocs.map((p) => [String(p._id), p]));

  const preview = [];
  let previewSeq = 0; // dry-run only, just for a representative preview number

  for (const r of toMigrate) {
    const payment = paymentById.get(String(r.payment));
    const totalAmount = r.amount;
    const gstAmount = Math.round(totalAmount / 11); // AU GST-inclusive convention, same as order.service.js#GST_DIVISOR

    // Minted one at a time, atomically, per refund — NOT read-once-then-
    // increment-in-memory. This step already crashed once mid-run on a
    // duplicate-key error unrelated to numbering; a counter that's only
    // persisted after the whole loop finishes would silently reuse numbers
    // on exactly that kind of retry, since the counter never advanced past
    // whatever it was before the crash. findOneAndUpdate($inc) is the same
    // atomic-sequence pattern order.service.js#nextOrderNumber already uses
    // — a script that dies after this call but before writing the refund
    // just burns a number, never reuses or collides one.
    let refundNumber = r.refund_number;
    if (!refundNumber) {
      if (write) {
        const counter = await counters.findOneAndUpdate(
          { _id: "refund_number" },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: "after" },
        );
        refundNumber = `CN-${String(counter.seq).padStart(5, "0")}`;
      } else {
        previewSeq += 1;
        refundNumber = `CN-${String(previewSeq).padStart(5, "0")} (preview only, not reserved)`;
      }
    }

    // stripe_refund_id must be OMITTED for a manual/eBay allocation, never
    // set to an explicit null — see paymentAllocationSchema's own comment:
    // the unique sparse index on this path only excludes an absent key, not
    // a present-but-null one, and this exact backfill hit that E11000 on
    // its first run before this fix.
    const allocation = {
      payment: r.payment,
      amount: totalAmount,
      provider: payment ? payment.provider : "unknown",
    };
    if (r.stripe_refund_id) allocation.stripe_refund_id = r.stripe_refund_id;

    const update = {
      scope: "amount",
      total_amount: totalAmount,
      items_amount: 0,
      gst_amount: gstAmount,
      payment_allocations: [allocation],
      refund_number: refundNumber,
    };

    if (preview.length < 10) preview.push({ _id: String(r._id), ...update });
    if (write) {
      await refunds.updateOne({ _id: r._id }, { $set: update });
    }
  }

  log("Sample (up to 10):", JSON.stringify(preview, null, 2));
}

// ── Step C: Order payment_status / fulfillment_status backfill ─────────────
//
// Idempotent by construction (recompute-and-assign, not increment — same
// philosophy as the revised §3.7) — safe to run every time regardless of
// whether a given order was already processed, so there's no "already done"
// check here at all.
const PAYMENT_VALUE_STATUSES = new Set([
  "pending_payment",
  "partially_paid",
  "paid",
  "partially_refunded",
  "refunded",
]);

async function backfillOrderStatus(db, { write }) {
  log("\n=== Step C: Order payment_status / fulfillment_status backfill ===");
  const orders = db.collection("orders");
  const payments = db.collection("payments");

  const cursor = orders.find({}, { projection: { status: 1, total: 1, order_number: 1 } });
  let scanned = 0;
  const preview = [];

  while (await cursor.hasNext()) {
    const order = await cursor.next();
    scanned++;

    const fulfillment_status =
      order.status === "fulfilled" ? "fulfilled" : order.status === "cancelled" ? "cancelled" : "unfulfilled";

    let payment_status;
    if (PAYMENT_VALUE_STATUSES.has(order.status)) {
      payment_status = order.status;
    } else {
      // status is "fulfilled" or "cancelled" — neither is a payment value,
      // so derive from actual payment history instead of guessing.
      const orderPayments = await payments.find({ order: order._id, status: "succeeded" }).toArray();
      const totalPaid = orderPayments.reduce((sum, p) => sum + Math.max(0, p.amount - (p.amount_refunded || 0)), 0);
      payment_status = totalPaid <= 0 ? "pending_payment" : totalPaid >= order.total ? "paid" : "partially_paid";
    }

    if (preview.length < 10) {
      preview.push({ order_number: order.order_number, old_status: order.status, payment_status, fulfillment_status });
    }
    if (write) {
      await orders.updateOne({ _id: order._id }, { $set: { payment_status, fulfillment_status } });
    }
  }

  log(`Orders scanned: ${scanned}`);
  log("Sample (up to 10):", JSON.stringify(preview, null, 2));
}

async function main() {
  await mongoose.connect(config.mongoUri);
  log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}${ONLY ? `, only: ${[...ONLY].join(",")}` : ""}`);
  const db = mongoose.connection.db;

  if (shouldRun("itemIds")) await backfillItemIds(db, { write: WRITE });
  if (shouldRun("refunds")) await backfillRefunds(db, { write: WRITE });
  if (shouldRun("orderStatus")) await backfillOrderStatus(db, { write: WRITE });

  if (!WRITE) {
    log("\nDry run only — nothing was written. Re-run with --write to apply.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
