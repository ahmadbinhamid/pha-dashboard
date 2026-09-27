// services/stripe/stripe.webhook.service.payment-status.test.js
// Webhook-paid orders set payment_status so they're refundable. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const Refund = require("../../models/Refund");
const stripeKeysService = require("../stripe/stripe.keys.service");
const { ORDER_PAYMENT_STATUS } = require("../../constants/order.constants");
// Email queue is built lazily on send; close it in `finally` or it hangs.
const emailQueueModule = require("../../queues/email.queue");

test("handlePaymentSucceeded sets payment_status, not just the legacy status field", async (t) => {
  await mongoose.connect(config.mongoUri);

  // Plain (non-async) list: thenable AND async-iterable (see fixture test).
  function makeListResponse(items) {
    const response = {
      data: items,
      async *[Symbol.asyncIterator]() {
        for (const item of items) yield item;
      },
    };
    response.then = (resolve) => resolve({ data: items });
    return response;
  }
  t.mock.method(stripeKeysService, "getStripeClient", async () => ({
    paymentIntents: {
      retrieve: async () => ({ payment_method: null }),
    },
    refunds: {
      list: () => makeListResponse([]),
      create: async () => ({ id: `re_test_${crypto.randomUUID()}` }),
    },
  }));
  const refundService = require("../refund.service");
  const { handleEvent } = require("./stripe.webhook.service");

  const suffix = crypto.randomUUID();
  const UNIT_PRICE = 2000;

  // Mirrors createStorefrontOrder: payment_status left at default, not "paid".
  const TEST_TENANT_ID = fixtureId();
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-PAYSTATUS-${suffix}`,
    invoice_number: `TEST-PAYSTATUS-INV-${suffix}`,
    items: [
      {
        product: fixtureId(),
        variant: null,
        name: "Payment status regression item",
        sku: null,
        unit_price: UNIT_PRICE,
        quantity: 1,
        discount_amount: 0,
      },
    ],
    customer: { name: "Payment Status Test", email: "test@example.com", phone: null },
    delivery_method: "pickup",
    subtotal: UNIT_PRICE,
    shipping_cost: 0,
    tax_amount: Math.round(UNIT_PRICE / 11),
    total: UNIT_PRICE,
    currency: "aud",
    channel: "storefront",
    // Both statuses default to pending_payment, as before Stripe confirms.
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  order.item_ids_migrated_at = new Date();
  await order.save();
  const itemId = order.items[0]._id.toString();

  const intentId = `pi_test_${suffix}`;
  const payment = await Payment.create({
    tenant_id: TEST_TENANT_ID,
    order: order._id,
    provider: "stripe",
    payment_method: null,
    amount: UNIT_PRICE,
    amount_refunded: 0,
    currency: "aud",
    status: "pending",
    stripe_payment_intent_id: intentId,
  });

  try {
    await t.test("before the webhook: neither field is paid", async () => {
      const fresh = await Order.findById(order._id);
      assert.equal(fresh.payment_status, ORDER_PAYMENT_STATUS.PENDING_PAYMENT);
    });

    // Driven through the real dispatcher, not a hand-set fixture or direct call.
    await handleEvent(
      {
        id: `evt_paystatus_${suffix}`,
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: intentId,
            amount_received: UNIT_PRICE,
            amount: UNIT_PRICE,
            currency: "aud",
          },
        },
      },
      TEST_TENANT_ID,
    );

    await t.test("after the webhook: payment_status is PAID, not just the legacy status", async () => {
      const fresh = await Order.findById(order._id);
      assert.equal(fresh.status, "paid", "sanity check — the legacy field was always working");
      assert.equal(
        fresh.payment_status,
        ORDER_PAYMENT_STATUS.PAID,
        "the field createRefund actually gates admission on must be updated by the SAME event that pays the order",
      );
    });

    await t.test("a refund can now actually be admitted — reproducing and closing the live bug", async () => {
      // Pre-fix this threw "not refundable"; PROCESSING proves admission was granted.
      const refund = await refundService.createRefund(
        order._id.toString(),
        {
          idempotency_key: `payment-status-regression-${suffix}`,
          scope: "line_items",
          lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
          reason: "customer_request",
        },
        null,
        TEST_TENANT_ID,
      );
      assert.equal(refund.status, "processing");
    });
  } finally {
    const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
    await StripeProcessedEvent.deleteOne({ stripe_event_id: `evt_paystatus_${suffix}` });
    await Refund.deleteMany({ order: order._id });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
    // The confirmation email already built the queue; close it before disconnect.
    await emailQueueModule.emailQueue.close();
    await mongoose.disconnect();
  }
});
