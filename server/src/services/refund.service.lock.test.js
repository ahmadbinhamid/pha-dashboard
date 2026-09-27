// services/refund.service.lock.test.js
// Fencing token stops a stale holder releasing a reclaimed lock. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const refundService = require("./refund.service");

const TEST_TENANT_ID = fixtureId();

async function createDisposableOrder() {
  const suffix = crypto.randomUUID();
  return Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-LOCK-${suffix}`,
    invoice_number: `TEST-LOCK-INV-${suffix}`,
    items: [
      {
        product: fixtureId(),
        variant: null,
        name: "Lock test item",
        sku: null,
        unit_price: 1000,
        quantity: 1,
        discount_amount: 0,
      },
    ],
    customer: { name: "Lock Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal: 1000,
    shipping_cost: 0,
    tax_amount: Math.round(1000 / 11),
    total: 1000,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "pending",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
}

test("refund lock: a stale holder's release does not clear a new holder's lock", async (t) => {
  await mongoose.connect(config.mongoUri);
  const order = await createDisposableOrder();

  try {
    // Holder A took the lock long ago and never released it (crashed/hung request).
    const STALE_MS = 30_000;
    const tokenA = "token-A";
    await Order.updateOne(
      { _id: order._id },
      { $set: { refund_lock_at: new Date(Date.now() - STALE_MS - 5_000), refund_lock_token: tokenA } },
    );

    let tokenB;

    await t.test("holder B can reclaim a stale lock", async () => {
      const claim = await refundService.acquireRefundLock(order._id.toString(), TEST_TENANT_ID);
      tokenB = claim.token;
      assert.notEqual(tokenB, tokenA, "B must get its own, different token");

      const fresh = await Order.findById(order._id);
      assert.equal(fresh.refund_lock_token, tokenB, "the stored token must be B's, not A's");
      assert.ok(Date.now() - fresh.refund_lock_at.getTime() < 5_000, "refund_lock_at must be refreshed to now, not left stale");
    });

    await t.test("A's own (late) release does not clear B's lock", async () => {
      // What createRefund's `finally` does if A finishes after being reclaimed.
      await refundService.releaseRefundLock(order._id.toString(), tokenA);

      const afterAsRelease = await Order.findById(order._id);
      assert.equal(afterAsRelease.refund_lock_token, tokenB, "B's token must survive A's stale release");
      assert.ok(afterAsRelease.refund_lock_at, "the lock must still be held (by B), not cleared");
    });

    await t.test("B's own release clears the lock correctly", async () => {
      await refundService.releaseRefundLock(order._id.toString(), tokenB);

      const afterBsRelease = await Order.findById(order._id);
      assert.equal(afterBsRelease.refund_lock_token, null, "B's own release must clear the token");
      assert.equal(afterBsRelease.refund_lock_at, null, "B's own release must clear refund_lock_at");
    });
  } finally {
    await Order.deleteOne({ _id: order._id });
    await mongoose.disconnect();
  }
});
