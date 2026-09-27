// services/refund.service.exhaustion.test.js
// Exhaustion needs qty, shipping and no manual adjustment covered. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");

const TEST_TENANT_ID = fixtureId();

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
        product: fixtureId(),
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
    fulfillment_status: "pending",
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
    // Units refunded singly, shipping never: items-only total, not fully refunded.
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

    // Same qty exhaustion, no shipping outstanding: residual fix must still fire.
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

    // Manual adjustment disables the residual shortcut: proportional math + adj.
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

        // Would be the exhausting refund, but has a $0.50 restocking-fee deduction.
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
