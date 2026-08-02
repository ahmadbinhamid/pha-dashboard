// services/refund.service.stale-processing.test.js
//
// Corrections round — getReservingRefunds must NEVER age a PROCESSING
// refund out of its reservation, unlike PENDING. PROCESSING means Stripe
// already accepted the refund and money is moving at Stripe's end; there is
// no "un-refund" API, so if a second refund were admitted for the same
// quantity/money while the first's webhook is merely delayed (Stripe
// incident, queue backlog, endpoint misconfigured), the first's webhook
// landing late would recompute the ledger, find a real violation, and
// auto-void ITSELF — even though Stripe had already paid it out. That's a
// customer refunded twice at Stripe with the books showing only one.
//
// This proves the fix holds even past the staleness window used for
// PENDING: the PROCESSING refund still reserves (blocking a conflicting
// second refund), and once its "webhook" finally lands, settlement
// completes normally rather than being auto-voided — because the
// reservation did its job and there was never a real double-claim to begin
// with.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.service.stale-processing.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");
const { REFUND_STATUS } = require("../constants/refund.constants");

const UNIT_PRICE = 1000;
const LINE_QUANTITY = 2;
const TEST_TENANT_ID = new mongoose.Types.ObjectId();

test("stale PROCESSING refund: still reserved, blocks a conflicting refund, not auto-voided on late confirmation", async (t) => {
  await mongoose.connect(config.mongoUri);

  const suffix = crypto.randomUUID();
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-STALEPROC-${suffix}`,
    invoice_number: `TEST-STALEPROC-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "Stale-processing test item",
        sku: null,
        unit_price: UNIT_PRICE,
        quantity: LINE_QUANTITY,
        discount_amount: 0,
      },
    ],
    customer: { name: "Stale Processing Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: UNIT_PRICE * LINE_QUANTITY,
    shipping_cost: 0,
    tax_amount: Math.round((UNIT_PRICE * LINE_QUANTITY) / 11),
    total: UNIT_PRICE * LINE_QUANTITY,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "unfulfilled",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  order.item_ids_migrated_at = new Date();
  await order.save();
  const itemId = order.items[0]._id.toString();

  const payment = await Payment.create({
    tenant_id: TEST_TENANT_ID,
    order: order._id,
    provider: "stripe",
    payment_method: null,
    amount: order.total,
    amount_refunded: 0,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
    stripe_payment_intent_id: `pi_test_${suffix}`,
  });

  try {
    // Refund A: a Stripe allocation that Stripe already accepted (PROCESSING),
    // for the FULL line quantity — created directly rather than through
    // createRefund, since we're simulating a webhook that's simply very
    // late, not exercising the create path itself.
    const refundNumberA = await refundService.nextRefundNumber(TEST_TENANT_ID);
    const refundA = await Refund.create({
      tenant_id: TEST_TENANT_ID,
      order: order._id,
      payment: payment._id,
      amount: UNIT_PRICE * LINE_QUANTITY,
      reason: "customer_request",
      status: REFUND_STATUS.PROCESSING,
      initiated_via: "admin_api",
      initiated_by: null,
      payment_allocations: [
        { payment: payment._id, amount: UNIT_PRICE * LINE_QUANTITY, provider: "stripe", settled: false, stripe_refund_id: `re_test_${suffix}` },
      ],
      refund_number: refundNumberA,
      scope: "line_items",
      lines: [
        {
          order_item_id: order.items[0]._id,
          sku: null,
          name: order.items[0].name,
          quantity: LINE_QUANTITY,
          unit_price: UNIT_PRICE,
          line_discount: 0,
          order_discount_share: 0,
          line_amount: UNIT_PRICE * LINE_QUANTITY,
          gst_amount: Math.round((UNIT_PRICE * LINE_QUANTITY) / 11),
          restock: false,
        },
      ],
      items_amount: UNIT_PRICE * LINE_QUANTITY,
      gst_amount: Math.round((UNIT_PRICE * LINE_QUANTITY) / 11),
      total_amount: UNIT_PRICE * LINE_QUANTITY,
      idempotency_key: `stale-proc-test-a-${suffix}`,
    });

    // Age it well past RESERVATION_STALE_AFTER_MS to simulate a webhook
    // that's been overdue for hours. created_at is immutable at the
    // Mongoose schema level (the timestamps plugin's default) — even a raw
    // Model.updateOne silently drops it, so this goes through the native
    // driver collection directly, bypassing Mongoose's cast/immutability
    // handling entirely.
    const staleCreatedAt = new Date(Date.now() - refundService.RESERVATION_STALE_AFTER_MS - 10 * 60 * 1000);
    await Refund.collection.updateOne({ _id: refundA._id }, { $set: { created_at: staleCreatedAt } });

    await t.test("still counted as reserving despite being older than the staleness window", async () => {
      const reserving = await Refund.find({ order: order._id }); // sanity: refund actually persisted stale
      assert.equal(reserving.length, 1);

      // getReservingRefunds isn't exported directly, but createRefund's own
      // admission math is driven by it — the next subtest proves this
      // behaviourally. This subtest asserts the raw fact the fix depends
      // on: the document really is older than the cutoff.
      const fresh = await Refund.findById(refundA._id);
      assert.ok(Date.now() - fresh.created_at.getTime() > refundService.RESERVATION_STALE_AFTER_MS, "must actually be stale");
      assert.equal(fresh.status, REFUND_STATUS.PROCESSING);
    });

    await t.test("a conflicting refund is rejected, not admitted", async () => {
      await assert.rejects(
        () =>
          refundService.createRefund(
            order._id.toString(),
            {
              idempotency_key: `stale-proc-test-b-${suffix}`,
              scope: "line_items",
              lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
              reason: "customer_request",
            },
            null,
            TEST_TENANT_ID,
          ),
        (err) => {
          // Rejected for exceeding what's left refundable — refund A's
          // (stale) PROCESSING reservation must still be counted, leaving
          // zero refundable, not the full line.
          assert.match(err.message, /exceeds what's left refundable|Invalid quantity/);
          return true;
        },
      );
    });

    await t.test("late webhook confirmation settles normally — no violation, no auto-void", async () => {
      // Simulate the webhook finally landing: the allocation settles and the
      // refund flips to SUCCEEDED (what stripe.webhook.service.js#reconcileStripeRefund
      // would do on confirmation), then applyRefundEffects runs — exactly
      // like a normal, on-time confirmation would. Because the conflicting
      // refund above was correctly rejected, there was never a real
      // double-claim, so this must settle clean.
      const stale = await Refund.findById(refundA._id);
      stale.payment_allocations[0].settled = true;
      stale.status = REFUND_STATUS.SUCCEEDED;
      await stale.save();

      const settled = await refundService.applyRefundEffects(stale._id);
      assert.equal(settled.status, REFUND_STATUS.SUCCEEDED, "must NOT be auto-voided — there was no actual over-claim");
      assert.equal(settled.needs_reconciliation, false);

      const freshOrder = await Order.findById(order._id);
      assert.equal(freshOrder.items[0].quantity_refunded, LINE_QUANTITY, "the ledger settles at exactly the line's quantity, no more");
    });
  } finally {
    await Refund.deleteMany({ order: order._id });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
    await mongoose.disconnect();
  }
});
