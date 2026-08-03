// scripts/backfillEbayOrderItemPricing.js
//
// One-off migration: eBay orders imported before ebay.order.mapper.js's
// reconcileLineItemTotals() landed can have a line item's unit_price
// inflated by the order's shipping cost — eBay's lineItems[].total is
// documented to exclude delivery cost, but in practice some orders
// (observed on Motors "freight"/calculated-shipping listings) report a
// total that already folds it in, and the mapper used to trust that value
// as-is. order.subtotal (set from eBay's own pricingSummary.priceSubtotal,
// authoritative and unaffected by this bug) is used here to recompute each
// affected order's item unit_price(s), the same way the mapper now does it
// for new imports.
//
// Only touches orders where every item's unit_price_updated_at is null
// (never manually re-priced by staff) — an order with any manual price
// edit is skipped and logged for manual review instead, since there's no
// way to tell here how much of that edit was correcting this same bug vs.
// an unrelated legitimate adjustment.
//
// Does not touch original_unit_price/unit_price_updated_at/_by — this is a
// correction of a data-import bug, not a staff price edit, so it leaves no
// entry in that audit trail.
//
// Safe to re-run: recomputing an already-correct unit_price is a no-op
// (skipped by the same tolerance check the mapper uses), so a second run
// finds nothing left to fix.
//
// Usage: node scripts/backfillEbayOrderItemPricing.js [--dry-run]

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Order = require("../src/models/Order");
const { ORDER_CHANNEL } = require("../src/constants/order.constants");

const DRY_RUN = process.argv.includes("--dry-run");

// Same reconciliation the mapper applies at import time — see
// ebay.order.mapper.js#reconcileLineItemTotals for the full rationale.
function reconcileItemTotals(items, subtotalCents) {
  const sumCents = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const diff = sumCents - subtotalCents;

  if (Math.abs(diff) <= items.length) return false; // within rounding — nothing to fix

  if (items.length === 1) {
    items[0].unit_price = Math.round(subtotalCents / items[0].quantity);
    return true;
  }

  let allocated = 0;
  items.forEach((it, idx) => {
    const isLast = idx === items.length - 1;
    const itemTotal = isLast
      ? subtotalCents - allocated
      : Math.round((it.unit_price * it.quantity * subtotalCents) / sumCents);
    allocated += itemTotal;
    it.unit_price = Math.round(itemTotal / it.quantity);
  });
  return true;
}

async function backfill() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run — no writes will be made)" : ""}`);

  const orders = await Order.find({ channel: ORDER_CHANNEL.EBAY });
  console.log(`Checking ${orders.length} eBay orders`);

  let fixed = 0;
  let skippedManualEdit = 0;
  let alreadyCorrect = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      if (order.items.some((it) => it.unit_price_updated_at)) {
        skippedManualEdit++;
        console.log(`  Skipping ${order.order_number} (${order._id}) — has a manually-edited item price`);
        continue;
      }

      const before = order.items.map((it) => it.unit_price);
      const changed = reconcileItemTotals(order.items, order.subtotal);

      if (!changed) {
        alreadyCorrect++;
        continue;
      }

      console.log(
        `  ${order.order_number} (${order._id}): unit_price ${before.join(", ")} -> ` +
          `${order.items.map((it) => it.unit_price).join(", ")} (subtotal ${order.subtotal})`,
      );

      if (!DRY_RUN) {
        // Raw updateOne, not order.save() — some legacy eBay orders predate
        // fields like invoice_number that are `required` on the schema
        // today, and a full-document .save() would fail validation on
        // those unrelated fields before ever writing the items fix. Same
        // convention backfillEbayPayments.js uses for the same reason.
        await Order.updateOne({ _id: order._id }, { $set: { items: order.items } });
      }
      fixed++;
    } catch (err) {
      failed++;
      console.error(`  Failed for order ${order.order_number} (${order._id}): ${err.message}`);
    }
  }

  console.log(
    `Done: ${fixed} fixed, ${alreadyCorrect} already correct, ${skippedManualEdit} skipped (manual edit)` +
      `${failed > 0 ? `, ${failed} failed` : ""} — out of ${orders.length} eBay orders`,
  );

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
