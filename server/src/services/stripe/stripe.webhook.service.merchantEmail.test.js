// services/stripe/stripe.webhook.service.merchantEmail.test.js
// A paid storefront order emails the store's inbox, or skips without one.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");
const { trackFixtureTenant } = require("../../testUtils/fixtureTenants");
const Tenant = require("../../models/Tenant");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const StripeProcessedEvent = require("../../models/StripeProcessedEvent");
const stripeKeysService = require("./stripe.keys.service");
const emailService = require("../email/email.service");
const notificationService = require("../notification.service");
const { handleEvent } = require("./stripe.webhook.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const UNIT_PRICE = 2500;

async function payStorefrontOrder(t, { storeEmail }) {
  t.mock.method(stripeKeysService, "getStripeClient", async () => ({
    paymentIntents: { retrieve: async () => ({ payment_method: null }) },
  }));
  t.mock.method(notificationService, "notifyNewOrder", async () => {});
  t.mock.method(emailService, "sendOrderReceivedPickup", async () => {});
  const merchantSpy = t.mock.method(emailService, "sendNewOrderToMerchant", async () => {});

  const suffix = crypto.randomUUID();
  const tenant = trackFixtureTenant(
    await Tenant.create({
      name: `Merchant email ${suffix}`,
      slug: `merchant-email-${suffix}`,
      code: `MEM${suffix.slice(0, 6).toUpperCase()}`,
      email: storeEmail,
    }),
  );
  const order = await Order.create({
    tenant_id: tenant._id,
    order_number: `TEST-MERCHANT-${suffix}`,
    invoice_number: `TEST-MERCHANT-INV-${suffix}`,
    items: [{ product: new mongoose.Types.ObjectId(), name: "Brake pads", sku: "BP-1", unit_price: UNIT_PRICE, quantity: 1 }],
    customer: { name: "Jo Buyer", email: "jo@example.com", phone: null },
    delivery_method: "pickup",
    subtotal: UNIT_PRICE,
    shipping_cost: 0,
    tax_amount: Math.round(UNIT_PRICE / 11),
    total: UNIT_PRICE,
    currency: "aud",
    channel: "storefront",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  const intentId = `pi_test_${suffix}`;
  await Payment.create({
    tenant_id: tenant._id,
    order: order._id,
    provider: "stripe",
    amount: UNIT_PRICE,
    currency: "aud",
    status: "pending",
    stripe_payment_intent_id: intentId,
  });
  const eventId = `evt_merchant_${suffix}`;
  t.after(async () => {
    await StripeProcessedEvent.deleteOne({ stripe_event_id: eventId });
    await Payment.deleteMany({ order: order._id });
    await Order.deleteOne({ _id: order._id });
  });

  await handleEvent(
    {
      id: eventId,
      type: "payment_intent.succeeded",
      data: { object: { id: intentId, amount_received: UNIT_PRICE, amount: UNIT_PRICE, currency: "aud" } },
    },
    tenant._id,
  );
  return { order, merchantSpy };
}

test("a paid storefront order emails the store's own inbox", async (t) => {
  const { order, merchantSpy } = await payStorefrontOrder(t, { storeEmail: "owner@store.test" });

  assert.equal(merchantSpy.mock.callCount(), 1);
  const [{ to, order: view }] = merchantSpy.mock.calls[0].arguments;
  assert.equal(to, "owner@store.test");
  assert.equal(view.customer_name, "Jo Buyer");
  assert.equal(view.delivery_label, "Pickup");
  assert.equal(view.address, null);
  assert.equal(view.items[0].line_total, "A$25.00");
  assert.match(view.order_url, new RegExp(`/orders/${order._id}$`));
});

test("a store without an email is skipped, the order still pays", async (t) => {
  const { order, merchantSpy } = await payStorefrontOrder(t, { storeEmail: null });

  assert.equal(merchantSpy.mock.callCount(), 0);
  assert.equal((await Order.findById(order._id).lean()).payment_status, "paid");
});
