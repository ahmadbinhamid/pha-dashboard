// services/stripe/stripe.webhook.service.fixture.test.js
//
// refund-redesign-spec.md §8 edge-case matrix rows 14-19 — testable without
// a real Stripe account by constructing the JSON event/object shapes Stripe
// actually sends and driving handleEvent/handleChargeRefunded/
// handleChargeRefundUpdated/reconcileStripeRefund directly, with
// stripe.keys.service#getStripeClient mocked (node:test's built-in mock
// support — same technique as refund.reconciliation.service.test.js).
//
// The mock must be installed BEFORE this file's own services are first
// required, since stripe.webhook.service.js and refund.service.js both
// call stripeKeysService.getStripeClient at their own module-load/call time.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/stripe/stripe.webhook.service.fixture.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const Refund = require("../../models/Refund");
const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
const Location = require("../../models/Location");
const Inventory = require("../../models/Inventory");
const stripeKeysService = require("./stripe.keys.service");
const { REFUND_STATUS } = require("../../constants/refund.constants");

// The real Stripe SDK's refunds.list() returns a hybrid "ApiListPromise" —
// thenable (so `const { data } = await stripe.refunds.list(...)`, used by
// handleChargeRefunded, resolves to an object with `.data`) AND directly
// async-iterable (so `for await (const r of stripe.refunds.list(...))`,
// used by refund.service.js#findExistingStripeRefund's auto-pagination,
// iterates WITHOUT a top-level await) on the SAME returned value. Wrapping
// this in an `async` function would break the second shape — the function
// itself would always return a native Promise, and a bare Promise has no
// Symbol.asyncIterator. `list` below is therefore a plain (non-async)
// function returning this hybrid object directly.
function makeListResponse(items) {
  const response = {
    data: items,
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
  // Resolve with a plain, non-thenable copy — NOT `response` itself. A
  // Promise resolving to a thenable recursively unwraps it by calling
  // `.then` again on that same value; since `response` is itself thenable,
  // resolving to `response` creates an infinite resolution loop that hangs
  // forever with no error (confirmed live — this is not hypothetical).
  response.then = (resolve) => resolve({ data: items });
  return response;
}

function buildFakeStripe({ createImpl, listImpl, retrieveImpl } = {}) {
  return {
    refunds: {
      create: createImpl || (async () => { throw new Error("unexpected stripe.refunds.create call"); }),
      list: listImpl || (() => makeListResponse([])),
      retrieve: retrieveImpl || (async () => { throw new Error("unexpected stripe.refunds.retrieve call"); }),
    },
  };
}

const TEST_TENANT_ID = new mongoose.Types.ObjectId();

async function createDisposableOrder({ quantity = 1, unitPrice = 1000, sku = null } = {}) {
  const suffix = crypto.randomUUID();
  const total = unitPrice * quantity;
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-WHFIX-${suffix}`,
    invoice_number: `TEST-WHFIX-INV-${suffix}`,
    items: [
      { product: new mongoose.Types.ObjectId(), variant: null, name: "Webhook fixture item", sku, unit_price: unitPrice, quantity, discount_amount: 0 },
    ],
    customer: { name: "Webhook Fixture Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: total,
    shipping_cost: 0,
    tax_amount: Math.round(total / 11),
    total,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "unfulfilled",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  order.item_ids_migrated_at = new Date();
  await order.save();
  return { order, suffix };
}

async function createStripePayment(order, { amount, suffix }) {
  return Payment.create({
    tenant_id: TEST_TENANT_ID,
    order: order._id,
    provider: "stripe",
    payment_method: null,
    amount,
    amount_refunded: 0,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
    stripe_payment_intent_id: `pi_test_${suffix}_${crypto.randomUUID()}`,
  });
}

test("webhook fixtures — §8 matrix rows 14-19", async (t) => {
  await mongoose.connect(config.mongoUri);

  // Installed exactly ONCE, before refund.service.js or stripe.webhook.service.js
  // are ever required — both call stripeKeysService.getStripeClient at their
  // own module-load/call time, so a mock re-installed per-subtest (via
  // t.mock.method inside each subtest's own `t`) would only ever reach
  // whichever module hadn't already captured an earlier binding. Indirecting
  // through a mutable `currentFakeStripe` that this ONE mock function reads
  // at CALL time — not require time — means every subtest can swap
  // behaviour just by reassigning the variable, regardless of load order.
  let currentFakeStripe = buildFakeStripe();
  t.mock.method(stripeKeysService, "getStripeClient", async () => currentFakeStripe);

  // ── Row 14: Stripe API errors mid-multi-allocation ──────────────────────
  await t.test("row 14: mid-multi-allocation Stripe failure marks the refund failed and records which allocation settled", async () => {
    let callCount = 0;
    currentFakeStripe = buildFakeStripe({
      createImpl: async () => {
        callCount += 1;
        if (callCount === 1) return { id: "re_first_ok" };
        throw Object.assign(new Error("Your card was declined (simulated)"), { code: "card_declined" });
      },
    });
    const refundService = require("../refund.service");

    const { order, suffix } = await createDisposableOrder({ quantity: 1, unitPrice: 2000 });
    const p1 = await createStripePayment(order, { amount: 1000, suffix: `${suffix}-a` });
    const p2 = await createStripePayment(order, { amount: 1000, suffix: `${suffix}-b` });

    try {
      await assert.rejects(
        () =>
          refundService.createRefund(
            order._id.toString(),
            { idempotency_key: `row14-${suffix}`, scope: "amount", amount: 2000, reason: "customer_request" },
            null,
            TEST_TENANT_ID,
          ),
        (err) => {
          assert.equal(err.status, 502);
          assert.match(err.message, /Earlier allocations on this refund may have already succeeded at Stripe/);
          return true;
        },
      );

      const [refund] = await Refund.find({ order: order._id });
      assert.equal(refund.status, REFUND_STATUS.FAILED);
      assert.ok(refund.failure_reason);
      assert.equal(refund.payment_allocations.length, 2, "must have split across both payments");
      // Which specific payment landed first isn't guaranteed down to the
      // millisecond in a fast test run — what matters is that EXACTLY ONE
      // allocation recorded the Stripe id that succeeded before the other
      // call failed, not which one.
      const withId = refund.payment_allocations.filter((a) => a.stripe_refund_id);
      const withoutId = refund.payment_allocations.filter((a) => !a.stripe_refund_id);
      assert.equal(withId.length, 1, "exactly one allocation must have already succeeded at Stripe");
      assert.equal(withId[0].stripe_refund_id, "re_first_ok");
      assert.equal(withoutId.length, 1, "the allocation that failed must NOT have a stripe_refund_id");
    } finally {
      await Refund.deleteMany({ order: order._id });
      await Payment.deleteMany({ order: order._id });
      await Order.deleteOne({ _id: order._id });
    }
  });

  // ── Row 15: Stripe returns pending, then succeeded via webhook ──────────
  await t.test("row 15: effects apply once, on webhook confirmation, guarded by effects_applied_at", async () => {
    currentFakeStripe = buildFakeStripe();
    const refundService = require("../refund.service");
    const { reconcileStripeRefund } = require("./stripe.webhook.service");

    const { order, suffix } = await createDisposableOrder({ quantity: 2, unitPrice: 1000 });
    const payment = await createStripePayment(order, { amount: 2000, suffix });
    const itemId = order.items[0]._id.toString();
    const stripeRefundId = `re_row15_${suffix}`;

    const refundNumber = await refundService.nextRefundNumber(TEST_TENANT_ID);
    const refund = await Refund.create({
      tenant_id: TEST_TENANT_ID,
      order: order._id,
      payment: payment._id,
      amount: 2000,
      reason: "customer_request",
      status: REFUND_STATUS.PROCESSING, // §3.7 — createRefund already returned this to the caller; webhook confirms it
      initiated_via: "admin_api",
      initiated_by: null,
      payment_allocations: [{ payment: payment._id, amount: 2000, provider: "stripe", settled: false, stripe_refund_id: stripeRefundId }],
      refund_number: refundNumber,
      scope: "line_items",
      lines: [
        { order_item_id: order.items[0]._id, sku: null, name: order.items[0].name, quantity: 2, unit_price: 1000, line_discount: 0, order_discount_share: 0, line_amount: 2000, gst_amount: 182, restock: false },
      ],
      items_amount: 2000,
      gst_amount: 182,
      total_amount: 2000,
      idempotency_key: `row15-${suffix}`,
    });

    try {
      const sr = { id: stripeRefundId, status: "succeeded" };

      // First webhook delivery — this is the "then succeeded via webhook" half.
      await reconcileStripeRefund(sr, payment, order);
      let freshOrder = await Order.findById(order._id);
      assert.equal(freshOrder.items[0].quantity_refunded, 2, "effects must be applied on first confirmation");
      let freshRefund = await Refund.findById(refund._id);
      assert.equal(freshRefund.status, REFUND_STATUS.SUCCEEDED);
      const firstAppliedAt = freshRefund.effects_applied_at.getTime();

      // A second, redundant confirmation for the same Stripe refund (e.g. a
      // retried/duplicated webhook attempt reaching this function again) —
      // must NOT double the ledger.
      await reconcileStripeRefund(sr, payment, order);
      freshOrder = await Order.findById(order._id);
      assert.equal(freshOrder.items[0].quantity_refunded, 2, "effects must be applied exactly once, not twice");
      freshRefund = await Refund.findById(refund._id);
      assert.equal(freshRefund.effects_applied_at.getTime(), firstAppliedAt, "effects_applied_at must not move on redelivery");
    } finally {
      await Refund.deleteMany({ order: order._id });
      await Payment.deleteMany({ order: order._id });
      await Order.deleteOne({ _id: order._id });
    }
  });

  // ── Row 16: Stripe refund succeeds then flips to failed ─────────────────
  await t.test("row 16: charge.refund.updated auto-reverses, including re-deducting restocked stock", async () => {
    currentFakeStripe = buildFakeStripe();
    const refundService = require("../refund.service");
    const { handleChargeRefundUpdated } = require("./stripe.webhook.service");

    const productId = new mongoose.Types.ObjectId();
    const sku = `ph-${productId.toHexString()}`;
    const { order: baseOrder, suffix } = await createDisposableOrder({ quantity: 1, unitPrice: 1000, sku });
    // Re-point the item's product to match the fallback-SKU id resolveSkuToIds expects.
    await Order.updateOne({ _id: baseOrder._id }, { $set: { "items.0.product": productId, "items.0.sku": sku } });
    const order = await Order.findById(baseOrder._id);

    const location = await Location.create({ name: `Row16 Location ${suffix}` });
    const STARTING_STOCK = 5;
    const inventory = await Inventory.create({ product: productId, variant: null, location: location._id, stock_count: STARTING_STOCK });

    const payment = await createStripePayment(order, { amount: 1000, suffix });
    const stripeRefundId = `re_row16_${suffix}`;
    const refundNumber = await refundService.nextRefundNumber(TEST_TENANT_ID);
    const refund = await Refund.create({
      tenant_id: TEST_TENANT_ID,
      order: order._id,
      payment: payment._id,
      amount: 1000,
      reason: "customer_request",
      status: REFUND_STATUS.SUCCEEDED,
      initiated_via: "admin_api",
      initiated_by: null,
      payment_allocations: [{ payment: payment._id, amount: 1000, provider: "stripe", settled: true, stripe_refund_id: stripeRefundId }],
      refund_number: refundNumber,
      scope: "line_items",
      lines: [
        { order_item_id: order.items[0]._id, sku, name: order.items[0].name, quantity: 1, unit_price: 1000, line_discount: 0, order_discount_share: 0, line_amount: 1000, gst_amount: 91, restock: true },
      ],
      items_amount: 1000,
      gst_amount: 91,
      total_amount: 1000,
      idempotency_key: `row16-${suffix}`,
    });
    const settled = await refundService.applyRefundEffects(refund._id);
    assert.equal(settled.effects_applied_at !== null, true);
    const afterApply = await Inventory.findById(inventory._id);
    assert.equal(afterApply.stock_count, STARTING_STOCK + 1, "restock must have applied before the reversal");

    try {
      await handleChargeRefundUpdated({ id: stripeRefundId, status: "failed" });

      const freshRefund = await Refund.findById(refund._id);
      assert.equal(freshRefund.status, REFUND_STATUS.VOIDED, "must be auto-reversed via the same void path an admin would use");

      const freshInventory = await Inventory.findById(inventory._id);
      assert.equal(freshInventory.stock_count, STARTING_STOCK, "the restocked unit must be re-deducted");

      const freshOrder = await Order.findById(order._id);
      assert.equal(freshOrder.items[0].quantity_refunded, 0, "voided — excluded from the ledger recompute");
    } finally {
      await Refund.deleteMany({ order: order._id });
      await Payment.deleteMany({ order: order._id });
      await Order.deleteOne({ _id: order._id });
      await Inventory.deleteOne({ _id: inventory._id });
      await Location.deleteOne({ _id: location._id });
    }
  });

  // ── Row 17: Duplicate charge.refunded delivery ───────────────────────────
  await t.test("row 17: claimEvent dedupes the event; a redelivered event never re-processes", async () => {
    const { order, suffix } = await createDisposableOrder({ quantity: 1, unitPrice: 1000 });
    const payment = await createStripePayment(order, { amount: 1000, suffix });
    const stripeRefundId = `re_row17_${suffix}`;

    currentFakeStripe = buildFakeStripe({
      listImpl: () => makeListResponse([{ id: stripeRefundId, status: "succeeded", amount: 1000, reason: "requested_by_customer" }]),
    });
    const refundService = require("../refund.service");
    const { handleEvent } = require("./stripe.webhook.service");

    const refundNumber = await refundService.nextRefundNumber(TEST_TENANT_ID);
    const refund = await Refund.create({
      tenant_id: TEST_TENANT_ID,
      order: order._id,
      payment: payment._id,
      amount: 1000,
      reason: "customer_request",
      status: REFUND_STATUS.PROCESSING,
      initiated_via: "admin_api",
      initiated_by: null,
      payment_allocations: [{ payment: payment._id, amount: 1000, provider: "stripe", settled: false, stripe_refund_id: stripeRefundId }],
      refund_number: refundNumber,
      scope: "line_items",
      lines: [
        { order_item_id: order.items[0]._id, sku: null, name: order.items[0].name, quantity: 1, unit_price: 1000, line_discount: 0, order_discount_share: 0, line_amount: 1000, gst_amount: 91, restock: false },
      ],
      items_amount: 1000,
      gst_amount: 91,
      total_amount: 1000,
      idempotency_key: `row17-${suffix}`,
    });

    const event = { id: `evt_row17_${suffix}`, type: "charge.refunded", data: { object: { payment_intent: payment.stripe_payment_intent_id } } };

    try {
      await handleEvent(event, TEST_TENANT_ID);
      const afterFirst = await Order.findById(order._id);
      assert.equal(afterFirst.items[0].quantity_refunded, 1);

      // The exact same event, redelivered — claimEvent's unique index on
      // stripe_event_id must reject it before handleChargeRefunded ever runs
      // again.
      await handleEvent(event, TEST_TENANT_ID);
      const afterSecond = await Order.findById(order._id);
      assert.equal(afterSecond.items[0].quantity_refunded, 1, "redelivery must be a complete no-op");

      const claims = await StripeProcessedEvent.countDocuments({ stripe_event_id: event.id });
      assert.equal(claims, 1);
    } finally {
      await Refund.deleteMany({ order: order._id });
      await Payment.deleteMany({ order: order._id });
      await Order.deleteOne({ _id: order._id });
      await StripeProcessedEvent.deleteOne({ stripe_event_id: event.id });
    }
  });

  // ── Rows 18 & 19: dashboard-issued refund, and the concurrency guard on it ─
  await t.test("rows 18/19: an unknown (dashboard-issued) Stripe refund is recorded once, correctly shaped", async () => {
    currentFakeStripe = buildFakeStripe();
    const refundService = require("../refund.service");
    const { reconcileStripeRefund } = require("./stripe.webhook.service");

    const { order, suffix } = await createDisposableOrder({ quantity: 1, unitPrice: 1000 });
    const payment = await createStripePayment(order, { amount: 1000, suffix });
    const stripeRefundId = `re_row1819_${suffix}`;
    const sr = { id: stripeRefundId, status: "succeeded", amount: 1000, reason: "requested_by_customer" };

    try {
      // Row 18 — two genuinely concurrent deliveries for the SAME
      // stripe_refund_id (two overlapping charge.refunded webhooks for one
      // charge) — both start their findOne before either write has landed.
      // The unique index on payment_allocations.stripe_refund_id is the
      // actual guard here, not a read-then-act check: one create() wins,
      // the other catches E11000 and returns.
      const results = await Promise.allSettled([
        reconcileStripeRefund(sr, payment, order),
        reconcileStripeRefund(sr, payment, order),
      ]);
      assert.ok(
        results.every((r) => r.status === "fulfilled"),
        "neither concurrent delivery should throw — the loser logs and returns, per reconcileStripeRefund's own E11000 handling",
      );

      const count = await Refund.countDocuments({ "payment_allocations.stripe_refund_id": stripeRefundId });
      assert.equal(count, 1, "row 18: exactly one Refund document, never a duplicate");

      // Row 19 — and it's shaped exactly as the spec requires.
      const created = await Refund.findOne({ "payment_allocations.stripe_refund_id": stripeRefundId });
      assert.equal(created.scope, "amount");
      assert.equal(created.needs_reconciliation, true);
      assert.equal(created.lines.length, 0, "no line data — restock was never offered for a refund we didn't initiate");
      assert.ok(created.effects_applied_at, "sr.status was already succeeded — effects apply immediately");

      const freshOrder = await Order.findById(order._id);
      assert.equal(freshOrder.items[0].quantity_refunded, 0, "an amount-only refund never touches item quantities");
    } finally {
      await Refund.deleteMany({ order: order._id });
      await Payment.deleteMany({ order: order._id });
      await Order.deleteOne({ _id: order._id });
    }
  });

  await mongoose.disconnect();
});
