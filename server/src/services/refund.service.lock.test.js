// services/refund.service.lock.test.js
//
// Corrections round — the fencing-token requirement: without it, a holder
// (A) whose critical section outlasted REFUND_LOCK_STALE_MS would have its
// lock reclaimed by a new caller (B), and A's own `finally { releaseRefundLock }`
// would then clear B's lock out from under it. Two callers would both
// believe they hold the lock — the exact admission race acquireRefundLock
// exists to prevent, reintroduced by the lock's own cleanup.
//
// This exercises the lock primitives directly (acquireRefundLock/
// releaseRefundLock, exported from refund.service.js for this test only)
// rather than indirectly through createRefund's full path, since the
// scenario being proven is specifically about the mutex's own token
// bookkeeping, not the refund business logic built on top of it.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.service.lock.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const Order = require("../models/Order");
const refundService = require("./refund.service");

const TEST_TENANT_ID = new mongoose.Types.ObjectId();

async function createDisposableOrder() {
  const suffix = crypto.randomUUID();
  return Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-LOCK-${suffix}`,
    invoice_number: `TEST-LOCK-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
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
    // Simulate holder A having acquired the lock a while ago (older than the
    // 30s staleness window) and never releasing it — a crashed/hung request,
    // the exact scenario the staleness window exists to recover from.
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
      // This is exactly what createRefund's `finally` block would do if A's
      // critical section only just finished after being reclaimed —
      // without the fencing token, this would null out B's lock.
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
