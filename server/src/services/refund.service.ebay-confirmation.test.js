// services/refund.service.ebay-confirmation.test.js
//
// refund-redesign-spec.md §5 gap — flagged and deferred in an earlier round,
// implemented here. An eBay-channel payment settles through eBay Managed
// Payments: a refund against it is bookkeeping only (no gateway call), and
// restocking pushes the SKU's quantity back UP on the live eBay listing. If
// the admin hasn't actually issued the refund in eBay Seller Hub, that push
// is a lie — stock rises while the sale still stands there. createRefund
// must require ebay_refund_confirmed: true whenever any resolved allocation
// is provider: "ebay", and persist that acknowledgement on the Refund doc.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/refund.service.ebay-confirmation.test.js

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

test("eBay refund confirmation gate", async (t) => {
  await mongoose.connect(config.mongoUri);

  const suffix = crypto.randomUUID();
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-EBAYCONF-${suffix}`,
    invoice_number: `TEST-EBAYCONF-INV-${suffix}`,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        variant: null,
        name: "eBay confirmation test item",
        sku: null,
        unit_price: 1000,
        quantity: 1,
        discount_amount: 0,
      },
    ],
    customer: { name: "eBay Confirmation Test", email: null, phone: null },
    delivery_method: "delivery",
    shipping_address: { address: "1 Test St", suburb: "Testville", state: "NSW", postcode: "2000" },
    subtotal: 1000,
    shipping_cost: 0,
    tax_amount: 91,
    total: 1000,
    currency: "aud",
    channel: "ebay",
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
    provider: "ebay",
    payment_method: null,
    amount: order.total,
    amount_refunded: 0,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
  });

  try {
    await t.test("rejected without ebay_refund_confirmed", async () => {
      await assert.rejects(
        () =>
          refundService.createRefund(
            order._id.toString(),
            {
              idempotency_key: `ebay-conf-a-${suffix}`,
              scope: "line_items",
              lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
              reason: "customer_request",
            },
            null,
            TEST_TENANT_ID,
          ),
        (err) => {
          assert.equal(err.status, 400);
          assert.match(err.message, /eBay Seller Hub/);
          return true;
        },
      );

      const refunds = await Refund.find({ order: order._id });
      assert.equal(refunds.length, 0, "no Refund document should be created when the gate rejects the request");
    });

    await t.test("succeeds and persists the acknowledgement when confirmed", async () => {
      const refund = await refundService.createRefund(
        order._id.toString(),
        {
          idempotency_key: `ebay-conf-b-${suffix}`,
          scope: "line_items",
          lines: [{ order_item_id: itemId, quantity: 1, restock: false }],
          reason: "customer_request",
          ebay_refund_confirmed: true,
        },
        null,
        TEST_TENANT_ID,
      );

      assert.equal(refund.ebay_refund_confirmed, true);
      assert.equal(refund.payment_allocations[0].provider, "ebay");
      assert.equal(refund.payment_allocations[0].settled, true, "non-Stripe allocations settle immediately");
    });
  } finally {
    await Refund.deleteMany({ order: order._id });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
    await mongoose.disconnect();
  }
});
