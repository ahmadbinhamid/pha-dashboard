// services/refund.service.exhaustion.test.js
//
// Design correction (deferred from the original corrections round, matrix
// rows 34/35) — quantity-exhaustion ≠ dollar-exhaustion. computeLineItemsScope's
// `isExhausting` used to be driven by quantities alone: once every item's
// quantity was claimed, it took the ENTIRE remaining order.total balance as
// this refund's total_amount (the rounding-drift residual shortcut —
// see refund-calculator.service.js#reconcileExhaustingTotal). But shipping
// attaches to no line item (scope: line_items never touches it) — if
// shipping was never separately refunded, that shortcut silently handed a
// pure line-item refund the leftover shipping money too, a real customer
// over-refund dressed up as ordinary item money. Fixed: exhaustion now
// requires quantities AND shipping AND no pending manual adjustment on THIS
// request all covered — see refund.service.js#computeLineItemsScope's own
// comment for the full reasoning on all three conditions.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.service.exhaustion.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");

const TEST_TENANT_ID = new mongoose.Types.ObjectId();

async function createDisposableOrder({ unitPrice, quantity, shippingCost }) {
  const suffix = crypto.randomUUID();
  const itemTotal = unitPrice * quantity;
  const total = itemTotal + shippingCost;
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-EXHAUST-${suffix}`,
    invoice_number: `TEST-EXHAUST-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "Exhaustion test item",
        sku: null,
        unit_price: unitPrice,
        quantity,
        discount_amount: 0,
      },
    ],
    customer: { name: "Exhaustion Test", email: null, phone: null },
    delivery_method: shippingCost > 0 ? "delivery" : "pickup",
    shipping_address:
      shippingCost > 0 ? { address: "1 Test St", suburb: "Testville", state: "NSW", postcode: "2000" } : null,
    subtotal: itemTotal,
    shipping_cost: shippingCost,
    tax_amount: Math.round(itemTotal / 11),
    total,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "unfulfilled",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  order.item_ids_migrated_at = new Date();
  await order.save();

  const payment = await Payment.create({
    tenant_id: TEST_TENANT_ID,
    order: order._id,
    provider: "manual",
    payment_method: "cash",
    amount: order.total,
    amount_refunded: 0,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
  });

  return { order, payment };
}

async function cleanup(order, payment) {
  await Refund.deleteMany({ order: order._id });
  await Payment.deleteMany({ order: order._id });
  await Order.deleteOne({ _id: order._id });
}

test("exhaustion: unclaimed shipping is never silently folded into a line_items-only refund", async (t) => {
  await mongoose.connect(config.mongoUri);

  try {
    // Row 34 — refund every unit individually (never scope: full_order),
    // shipping never explicitly refunded. total_amount must be items-only;
    // the order must NOT read as fully refunded (shipping is still owed).
    await t.test("all quantities claimed, shipping outstanding — total_amount stays items-only", async () => {
      const { order, payment } = await createDisposableOrder({ unitPrice: 1000, quantity: 3, shippingCost: 500 });
      const itemId = order.items[0]._id.toString();
      try {
        const refund = await refundService.createRefund(
          order._id.toString(),
          {
            idempotency_key: `exhaust-a-${order._id}`,
            scope: "line_items",
            lines: [{ order_item_id: itemId, quantity: 3, restock: false }],
            reason: "customer_request",
          },
          null,
          TEST_TENANT_ID,
        );

        assert.equal(refund.total_amount, 3000, "must be items-only (3 × $10) — the $5 shipping must NOT be absorbed in here");
        assert.equal(refund.shipping_amount, 0, "scope: line_items never touches shipping");

        const freshOrder = await Order.findById(order._id);
        assert.equal(
          freshOrder.payment_status,
          "partially_refunded",
          "the $5 shipping is still genuinely outstanding — the order must not read as fully refunded",
        );

        const summary = await refundService.getRefundableSummary(order._id.toString(), TEST_TENANT_ID);
        assert.equal(summary.max_refundable, 500, "the $5 shipping must still show as refundable, not silently consumed");
      } finally {
        await cleanup(order, payment);
      }
    });

    // Row 35 — the same quantity-exhaustion signal, but shipping genuinely
    // has nothing outstanding (here: no shipping cost at all). The
    // pre-existing rounding-drift residual correction must still fire
    // correctly — this fix must not regress that behaviour.
    await t.test("shipping covered (none owed) — legitimate exhaustion still takes the exact GST residual", async () => {
      const { order, payment } = await createDisposableOrder({ unitPrice: 101, quantity: 3, shippingCost: 0 });
      const itemId = order.items[0]._id.toString();
      try {
        const refund1 = await refundService.createRefund(
          order._id.toString(),
          {
            idempotency_key: `exhaust-b1-${order._id}`,
            scope: "line_items",
            lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
            reason: "customer_request",
          },
          null,
          TEST_TENANT_ID,
        );
        assert.equal(refund1.total_amount, 101);
        assert.equal(refund1.gst_amount, 9, "proportional: round(101/11)");

        const refund2 = await refundService.createRefund(
          order._id.toString(),
          {
            idempotency_key: `exhaust-b2-${order._id}`,
            scope: "line_items",
            lines: [{ order_item_id: itemId, quantity: 2, restock: false }],
            reason: "customer_request",
          },
          null,
          TEST_TENANT_ID,
        );
        assert.equal(refund2.total_amount, 202, "exact residual: order.total(303) - priorTotalRefunded(101)");
        assert.equal(refund2.gst_amount, 19, "exact residual: order.tax_amount(28) - priorGstRefunded(9), not round(202/11)=18");

        assert.equal(refund1.total_amount + refund2.total_amount, order.total);
        assert.equal(refund1.gst_amount + refund2.gst_amount, order.tax_amount);

        const freshOrder = await Order.findById(order._id);
        assert.equal(freshOrder.payment_status, "refunded");
      } finally {
        await cleanup(order, payment);
      }
    });

    // A manual adjustment (e.g. a restocking fee) on what would otherwise be
    // the exhausting refund must disable the residual shortcut — mixing
    // "take everything left" with an unrelated manual adjustment would stack
    // them, not compose them cleanly. The natural (proportional) math is
    // used instead, with the adjustment applied on top of THAT.
    await t.test("a manual adjustment on the final refund disables the exhaustion shortcut", async () => {
      const { order, payment } = await createDisposableOrder({ unitPrice: 101, quantity: 3, shippingCost: 0 });
      const itemId = order.items[0]._id.toString();
      try {
        const refund1 = await refundService.createRefund(
          order._id.toString(),
          {
            idempotency_key: `exhaust-c1-${order._id}`,
            scope: "line_items",
            lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
            reason: "customer_request",
          },
          null,
          TEST_TENANT_ID,
        );
        assert.equal(refund1.gst_amount, 9);

        // Quantities are now fully claimed after this second request — it
        // WOULD be the exhausting refund, except it also carries a $0.50
        // restocking-fee deduction.
        const refund2 = await refundService.createRefund(
          order._id.toString(),
          {
            idempotency_key: `exhaust-c2-${order._id}`,
            scope: "line_items",
            lines: [{ order_item_id: itemId, quantity: 2, restock: false }],
            adjustment_amount: -50,
            reason: "customer_request",
          },
          null,
          TEST_TENANT_ID,
        );

        assert.equal(refund2.gst_amount, 18, "must use the NATURAL proportional GST (round(202/11)), not the exact residual (19)");
        assert.equal(refund2.total_amount, 152, "natural items total (202) plus the -50 restocking-fee adjustment");
        assert.equal(refund2.adjustment_amount, -50);
      } finally {
        await cleanup(order, payment);
      }
    });
  } finally {
    await mongoose.disconnect();
  }
});
