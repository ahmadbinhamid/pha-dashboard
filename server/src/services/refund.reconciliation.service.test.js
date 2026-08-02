// services/refund.reconciliation.service.test.js
//
// Corrections round — reconcileStuckRefunds must distinguish "Stripe
// confirmed this refund doesn't exist" (code: 'resource_missing' — the only
// answer that legitimately releases a PROCESSING reservation) from every
// other error (rate limit, timeout, transient 500 — Stripe being briefly
// unreachable, not proof the refund never happened). Misreading a transient
// error as resource_missing would release money that's still genuinely
// moving at Stripe — getReservingRefunds deliberately never age-bounds
// PROCESSING for exactly this reason.
//
// Mocks stripe.keys.service#getStripeClient via node:test's built-in mock
// support, since this needs to exercise a specific Stripe API failure mode
// without a real Stripe account. The mock must be installed BEFORE
// refund.reconciliation.service.js (and, transitively,
// stripe.webhook.service.js) are first required in this process — both call
// stripeKeysService.getStripeClient at their own module-load/call time, so
// the mock has to already be in place for that to pick it up.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.reconciliation.service.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const refundService = require("./refund.service");
const stripeKeysService = require("./stripe/stripe.keys.service");
const { REFUND_STATUS } = require("../constants/refund.constants");

test("reconciliation: a transient Stripe error leaves a PROCESSING refund untouched and still reserving", async (t) => {
  await mongoose.connect(config.mongoUri);

  const transientError = Object.assign(new Error("Rate limited"), { code: "rate_limit" });
  t.mock.method(stripeKeysService, "getStripeClient", async () => ({
    refunds: {
      retrieve: async () => {
        throw transientError;
      },
    },
  }));

  // Required only now — after the mock is installed — so its own (and
  // stripe.webhook.service.js's) calls to stripeKeysService.getStripeClient
  // pick up the mocked function, not the real one.
  const { reconcileStuckRefunds } = require("./refund.reconciliation.service");

  const TEST_TENANT_ID = new mongoose.Types.ObjectId();
  const suffix = crypto.randomUUID();
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-RECON-${suffix}`,
    invoice_number: `TEST-RECON-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "Reconciliation test item",
        sku: null,
        unit_price: 1000,
        quantity: 2,
        discount_amount: 0,
      },
    ],
    customer: { name: "Reconciliation Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: 2000,
    shipping_cost: 0,
    tax_amount: 182,
    total: 2000,
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
    const refundNumber = await refundService.nextRefundNumber(TEST_TENANT_ID);
    const refund = await Refund.create({
      tenant_id: TEST_TENANT_ID,
      order: order._id,
      payment: payment._id,
      amount: 2000,
      reason: "customer_request",
      status: REFUND_STATUS.PROCESSING,
      initiated_via: "admin_api",
      initiated_by: null,
      payment_allocations: [
        { payment: payment._id, amount: 2000, provider: "stripe", settled: false, stripe_refund_id: `re_test_${suffix}` },
      ],
      refund_number: refundNumber,
      scope: "line_items",
      lines: [
        {
          order_item_id: order.items[0]._id,
          sku: null,
          name: order.items[0].name,
          quantity: 2,
          unit_price: 1000,
          line_discount: 0,
          order_discount_share: 0,
          line_amount: 2000,
          gst_amount: 182,
          restock: false,
        },
      ],
      items_amount: 2000,
      gst_amount: 182,
      total_amount: 2000,
      idempotency_key: `recon-test-${suffix}`,
    });

    // Backdate past RESERVATION_STALE_AFTER_MS so this is exactly the
    // refund reconcileStuckRefunds' query would pick up — created_at is
    // immutable at the Mongoose schema level, so this goes through the
    // native driver collection directly (same as refund.service.stale-processing.test.js).
    const staleCreatedAt = new Date(Date.now() - refundService.RESERVATION_STALE_AFTER_MS - 10 * 60 * 1000);
    await Refund.collection.updateOne({ _id: refund._id }, { $set: { created_at: staleCreatedAt } });

    const summary = await reconcileStuckRefunds();

    await t.test("the refund is left untouched — still PROCESSING, still unsettled", async () => {
      const fresh = await Refund.findById(refund._id);
      assert.equal(fresh.status, REFUND_STATUS.PROCESSING, "a transient error must never be treated as proof the refund is gone");
      assert.equal(fresh.payment_allocations[0].settled, false);
      assert.equal(fresh.needs_reconciliation, false, "not resolved, so not (yet) flagged as needing reconciliation either");
    });

    await t.test("the sweep reports it as still pending, not resolved or errored", () => {
      assert.equal(summary.stillPending, 1);
      assert.equal(summary.resolved, 0);
      assert.equal(summary.errors, 0, "a transient Stripe error is handled, not an unhandled failure");
    });

    await t.test("it still reserves — a conflicting refund is rejected, not admitted", async () => {
      await assert.rejects(
        () =>
          refundService.createRefund(
            order._id.toString(),
            {
              idempotency_key: `recon-test-conflict-${suffix}`,
              scope: "line_items",
              lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
              reason: "customer_request",
            },
            null,
            TEST_TENANT_ID,
          ),
        (err) => {
          assert.match(err.message, /exceeds what's left refundable|Invalid quantity/);
          return true;
        },
      );
    });
  } finally {
    await Refund.deleteMany({ order: order._id });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
    await mongoose.disconnect();
  }
});
