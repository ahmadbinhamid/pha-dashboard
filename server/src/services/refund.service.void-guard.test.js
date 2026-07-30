// services/refund.service.void-guard.test.js
//
// Corrections round — voidRefund only reverses OUR books; there is no
// Stripe API to "un-refund" a charge. Once a Stripe allocation has settled
// (webhook-confirmed), voiding here would desync the ledger from what
// Stripe actually did rather than fix anything. This proves the admin void
// path is blocked on a settled Stripe refund without an explicit `force`,
// while the legitimate exception (source: "stripe_reversal", used by
// stripe.webhook.service.js#handleChargeRefundUpdated for §4.2) still goes
// through — and that force: true still works when genuinely intended.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.service.void-guard.test.js

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

async function makeSettledStripeRefund(order, payment, suffix, idemSuffix) {
  const refundNumber = await refundService.nextRefundNumber();
  return Refund.create({
    order: order._id,
    payment: payment._id,
    amount: 1000,
    reason: "customer_request",
    status: REFUND_STATUS.SUCCEEDED,
    initiated_via: "admin_api",
    initiated_by: null,
    payment_allocations: [{ payment: payment._id, amount: 1000, provider: "stripe", settled: true, stripe_refund_id: `re_test_${idemSuffix}` }],
    refund_number: refundNumber,
    scope: "amount",
    lines: [],
    items_amount: 0,
    gst_amount: Math.round(1000 / 11),
    total_amount: 1000,
    idempotency_key: `void-guard-${idemSuffix}`,
  });
}

test("voidRefund: blocks a settled Stripe refund without force, allows stripe_reversal and force", async (t) => {
  await mongoose.connect(config.mongoUri);

  const suffix = crypto.randomUUID();
  const order = await Order.create({
    order_number: `TEST-VOIDGUARD-${suffix}`,
    invoice_number: `TEST-VOIDGUARD-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "Void guard test item",
        sku: null,
        unit_price: 1000,
        quantity: 1,
        discount_amount: 0,
      },
    ],
    customer: { name: "Void Guard Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: 1000,
    shipping_cost: 0,
    tax_amount: 91,
    total: 1000,
    currency: "aud",
    channel: "manual",
    payment_status: "partially_refunded",
    fulfillment_status: "unfulfilled",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });

  const payment = await Payment.create({
    order: order._id,
    provider: "stripe",
    payment_method: null,
    amount: order.total,
    amount_refunded: 1000,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
    stripe_payment_intent_id: `pi_test_${suffix}`,
  });

  try {
    await t.test("blocked without force", async () => {
      const refund = await makeSettledStripeRefund(order, payment, suffix, `a-${suffix}`);
      await assert.rejects(
        () => refundService.voidRefund(refund._id, { reason: "test void attempt", userId: null }),
        (err) => {
          assert.equal(err.status, 409);
          assert.match(err.message, /force/);
          return true;
        },
      );
      const stillSucceeded = await Refund.findById(refund._id);
      assert.equal(stillSucceeded.status, REFUND_STATUS.SUCCEEDED, "must remain untouched, not voided");
    });

    await t.test("allowed with force: true", async () => {
      const refund = await makeSettledStripeRefund(order, payment, suffix, `b-${suffix}`);
      const voided = await refundService.voidRefund(refund._id, { reason: "test void with force", userId: null, force: true });
      assert.equal(voided.status, REFUND_STATUS.VOIDED);
    });

    await t.test("allowed for source: stripe_reversal without force (the §4.2 path)", async () => {
      const refund = await makeSettledStripeRefund(order, payment, suffix, `c-${suffix}`);
      const voided = await refundService.voidRefund(refund._id, {
        reason: "test stripe reversal",
        userId: null,
        source: "stripe_reversal",
      });
      assert.equal(voided.status, REFUND_STATUS.VOIDED);
    });

    await t.test("an all-manual refund voids normally with no force needed", async () => {
      const refundNumber = await refundService.nextRefundNumber();
      const manualRefund = await Refund.create({
        order: order._id,
        payment: payment._id,
        amount: 1000,
        reason: "customer_request",
        status: REFUND_STATUS.SUCCEEDED,
        initiated_via: "admin_api",
        initiated_by: null,
        payment_allocations: [{ payment: payment._id, amount: 1000, provider: "manual", settled: true }],
        refund_number: refundNumber,
        scope: "amount",
        lines: [],
        items_amount: 0,
        gst_amount: 91,
        total_amount: 1000,
        idempotency_key: `void-guard-manual-${suffix}`,
      });
      const voided = await refundService.voidRefund(manualRefund._id, { reason: "test manual void", userId: null });
      assert.equal(voided.status, REFUND_STATUS.VOIDED);
    });
  } finally {
    await Refund.deleteMany({ order: order._id });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
    await mongoose.disconnect();
  }
});
