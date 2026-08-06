// services/refund.service.concurrency.test.js
//
// refund-redesign-spec.md §9 required this explicitly: N parallel
// single-unit refunds on a 5-unit line, exactly 5 succeed, ledger never
// exceeds line quantity — run repeatedly, not once. This is the test that
// exists specifically because the derived-state ledger makes effect
// APPLICATION idempotent but does nothing for ADMISSION (read-then-act
// validation) on its own — see refund.service.js#acquireRefundLock's own
// comment for the exact race this test is designed to catch.
//
// Needs a live Mongo connection (this is validating real atomic-update
// behaviour, not pure math) — run with:
//   node --test src/services/refund.service.concurrency.test.js
// against the same dev DB the rest of this work has been verified against.
// Creates and tears down its own disposable Order/Payment/Refund documents
// each run; safe to run repeatedly and does not depend on any other data.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const Counter = require("../models/Counter");
const refundService = require("./refund.service");

const LINE_QUANTITY = 5;
const PARALLEL_REQUESTS = 10; // > LINE_QUANTITY on purpose — see the file header
const REPEAT_RUNS = 5; // "run it repeatedly not once"

const TEST_TENANT_ID = new mongoose.Types.ObjectId();

async function createDisposableOrder() {
  const suffix = crypto.randomUUID();
  const orderNumber = `TEST-CONC-${suffix}`;

  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: orderNumber,
    invoice_number: `TEST-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "Concurrency test item",
        sku: null, // no SKU — no restock/inventory side effects to worry about in this test
        unit_price: 1000, // $10.00/unit, GST-inclusive
        quantity: LINE_QUANTITY,
        discount_amount: 0,
      },
    ],
    customer: { name: "Concurrency Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: 1000 * LINE_QUANTITY,
    shipping_cost: 0,
    tax_amount: Math.round((1000 * LINE_QUANTITY) / 11),
    total: 1000 * LINE_QUANTITY,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "pending",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });

  // item._id is genuinely persisted here (Order.create actually writes to
  // disk, unlike the in-memory-only auto-generation on a mere hydrate — see
  // Order.js's item_ids_migrated_at comment) — safe to mark migrated.
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

async function cleanupDisposableOrder(order, payment) {
  await Refund.deleteMany({ order: order._id });
  await Payment.deleteMany({ order: order._id });
  await Order.deleteOne({ _id: order._id });
}

async function runOneRound(roundIndex) {
  const { order, payment } = await createDisposableOrder();
  const itemId = order.items[0]._id.toString();

  try {
    const requests = Array.from({ length: PARALLEL_REQUESTS }, (_, i) =>
      refundService.createRefund(
        order._id.toString(),
        {
          idempotency_key: `conc-test-${roundIndex}-${i}-${crypto.randomUUID()}`,
          scope: "line_items",
          lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
          reason: "customer_request",
        },
        null,
        TEST_TENANT_ID,
      ),
    );

    const results = await Promise.allSettled(requests);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    const freshOrder = await Order.findById(order._id);
    const finalQuantityRefunded = freshOrder.items[0].quantity_refunded;
    const finalPayment = await Payment.findOne({ order: order._id });

    return {
      succeededCount: succeeded.length,
      rejectedCount: rejected.length,
      rejectedMessages: rejected.map((r) => r.reason?.message),
      finalQuantityRefunded,
      finalAmountRefunded: finalPayment.amount_refunded,
      finalLockState: freshOrder.refund_lock_at, // must be null — released even after rejections
    };
  } finally {
    await cleanupDisposableOrder(order, payment);
  }
}

test("concurrency: N parallel single-unit refunds on a 5-unit line — exactly 5 succeed, run repeatedly", async (t) => {
  await mongoose.connect(config.mongoUri);
  await Counter.updateOne({ _id: "refund_number" }, {}, { upsert: true }); // ensure it exists, harmless if already there

  try {
    for (let round = 0; round < REPEAT_RUNS; round++) {
      const result = await runOneRound(round);

      await t.test(`round ${round + 1}/${REPEAT_RUNS}`, () => {
        assert.equal(result.succeededCount, LINE_QUANTITY, `expected exactly ${LINE_QUANTITY} to succeed`);
        assert.equal(result.rejectedCount, PARALLEL_REQUESTS - LINE_QUANTITY, "the rest must be rejected, not silently dropped");
        assert.equal(result.finalQuantityRefunded, LINE_QUANTITY, "ledger must never exceed line quantity");
        assert.equal(result.finalAmountRefunded, LINE_QUANTITY * 1000, "payment.amount_refunded must match exactly 5 units");
        assert.equal(result.finalLockState, null, "lock must be released even after rejected requests, not just successes");
        // Every rejection should be the lock timing out, the line's quantity
        // being exhausted, or — once the order itself has fully transitioned
        // to "refunded" for a later racer that got its turn after the 5th
        // unit already went through — the payment_status check. Never an
        // unrelated crash.
        for (const msg of result.rejectedMessages) {
          assert.ok(
            /Another refund is already in progress/.test(msg) ||
              /Invalid quantity/.test(msg) ||
              /is not refundable/.test(msg),
            `unexpected rejection reason: ${msg}`,
          );
        }
      });
    }
  } finally {
    await mongoose.disconnect();
  }
});
