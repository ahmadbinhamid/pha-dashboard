// services/order-edit.service.test.js
// Unpaid order edits: totals, editability, Stripe race, version, stock, audit.

const test = require("node:test");
const { before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");

require("../models/index");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Customer = require("../models/Customer");
const Location = require("../models/Location");
const Inventory = require("../models/Inventory");
const MarketplaceListing = require("../models/MarketplaceListing");
const channelQueue = require("../queues/channel.queue");
// Fan-out skips platforms with no registered adapter.
require("./marketplace/registerAdapters").registerAdapters();
const stripeKeysService = require("./stripe/stripe.keys.service");
const paymentGuard = require("./stripe/stripe.payment-guard.service");
const orderService = require("./order.service");
const edits = require("./order-edit.service");
const { computeOrderTotals } = require("../utils/orderTotals");

const USER = { id: null, name: "Sam Staff" };
let tenant;
let fanOuts;
let stripe;

// A fake Stripe client whose intent status and cancel outcome each test sets.
function fakeStripe({ status, cancel = async () => ({ status: "canceled" }) }) {
  const calls = { retrieve: 0, cancel: 0 };
  const client = {
    paymentIntents: {
      retrieve: async (id) => {
        calls.retrieve++;
        return { id, status };
      },
      cancel: async (id) => {
        calls.cancel++;
        return cancel(id);
      },
    },
  };
  return { client, calls };
}

before(async () => {
  await mongoose.connect(config.mongoUri);
  const id = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  tenant = { _id: id, order_number_prefix: "TST", invoice_number_prefix: "TIN" };
  await mongoose.connection.collection("tenants").insertOne({
    _id: id, name: `Edit ${suffix}`, slug: `edit-${suffix}`, code: `ED${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
});
after(() => mongoose.disconnect());

beforeEach(() => {
  mock.restoreAll();
  fanOuts = [];
  mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    fanOuts.push(args);
  });
  stripe = fakeStripe({ status: "requires_payment_method" });
  mock.method(stripeKeysService, "getStripeClient", async () => stripe.client);
});

// A stock-tracked product with `stock` units at one location; optional variant.
async function makeProduct({ stock = 20, price = 50, withVariant = false, owner = tenant._id } = {}) {
  const suffix = crypto.randomUUID();
  const product = await Product.create({
    tenant_id: owner, title: `Part ${suffix.slice(0, 6)}`, slug: `part-${suffix}`, sku: `SKU-${suffix}`,
    price, stock_control: true, shipping_cost: 0,
  });
  const location = await Location.create({ tenant_id: owner, name: `Shelf ${suffix}` });
  const variant = withVariant
    ? await ProductVariant.create({ tenant_id: owner, product: product._id, sku: `VAR-${suffix}`, price: price + 5, display_name: "Left" })
    : null;
  await Inventory.create({ tenant_id: owner, product: product._id, variant: variant?._id ?? null, location: location._id, stock_count: stock });
  return { product, variant };
}

const stockOf = async (product, variant = null) =>
  (await Inventory.findOne({ product: product._id, variant: variant?._id ?? null }).lean()).stock_count;

async function makeOrder(items, { channel } = {}) {
  const customer = await Customer.create({ tenant_id: tenant._id, name: "Walk-in", email: `c-${crypto.randomUUID()}@example.com` });
  const order = await orderService.createManualOrder(
    { customer_id: customer._id, items, payment_method: "payment_link" },
    tenant,
  );
  if (channel) await Order.updateOne({ _id: order._id }, { $set: { channel } });
  return Order.findById(order._id);
}

const line = (product, quantity = 2) => ({ product: product._id, variant: null, quantity });
const customLine = { is_custom: true, name: "Fitting labour", unit_price: 40, quantity: 1 };

async function openIntent(order) {
  return Payment.create({
    tenant_id: tenant._id, order: order._id, provider: "stripe", stripe_payment_intent_id: `pi_${crypto.randomUUID()}`,
    amount: order.total, currency: "aud", status: "pending",
  });
}

const rejectsWith = (promise, status, code) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.status, status, err.message);
    if (code) assert.equal(err.code, code);
    return true;
  });

// Everything an edit could touch, to prove a rejected edit touched nothing.
async function snapshot(order, product) {
  const doc = await Order.findById(order._id).lean();
  return {
    items: JSON.stringify(doc.items), total: doc.total, v: doc.__v, notes: doc.internal_notes.length,
    stock: product ? await stockOf(product) : null,
    payments: JSON.stringify(await Payment.find({ order: order._id }).select("status").lean()),
  };
}

// ── Totals and items ──

test("add, change quantity and remove recompute totals with creation's helper", async () => {
  const { product: a } = await makeProduct({ price: 30 });
  const { product: b } = await makeProduct({ price: 12.5 });
  const order = await makeOrder([line(a, 1)]);

  const added = await edits.addOrderItem(order._id, { version: order.__v, item: line(b, 3) }, USER, tenant._id);
  const changed = await edits.updateOrderItemQuantity(order._id, added.items[0]._id, { version: added.__v, quantity: 4 }, USER, tenant._id);
  const removed = await edits.removeOrderItem(order._id, changed.items[1]._id, { version: changed.__v }, USER, tenant._id);

  for (const doc of [added, changed, removed]) {
    const expected = computeOrderTotals(doc.items, { shippingCost: doc.shipping_cost, orderDiscount: doc.discount_amount });
    assert.deepEqual({ subtotal: doc.subtotal, tax_amount: doc.tax_amount, total: doc.total }, expected);
  }
  // The same final lines created fresh give the same totals.
  const fresh = await makeOrder([line(a, 4)]);
  assert.deepEqual([removed.subtotal, removed.tax_amount, removed.total], [fresh.subtotal, fresh.tax_amount, fresh.total]);
  assert.equal(removed.total, 12000);
});

test("re-adding a product already on the order raises its quantity; custom lines stay separate", async () => {
  const { product } = await makeProduct({ stock: 20, price: 20 });
  const order = await makeOrder([line(product, 1)]);
  const stockBefore = await stockOf(product);

  const merged = await edits.addOrderItem(order._id, { version: order.__v, item: line(product, 2) }, USER, tenant._id);
  assert.equal(merged.items.length, 1, "no duplicate line");
  assert.equal(merged.items[0].quantity, 3);
  assert.equal(String(merged.items[0]._id), String(order.items[0]._id), "the same line, not a new one");
  assert.equal(merged.total, 6000);
  assert.equal(await stockOf(product), stockBefore - 2, "only the added units are deducted");
  assert.match(merged.internal_notes.at(-1).text, /changed 1 → 3/);

  const first = await edits.addOrderItem(order._id, { version: merged.__v, item: customLine }, USER, tenant._id);
  const second = await edits.addOrderItem(order._id, { version: first.__v, item: customLine }, USER, tenant._id);
  assert.equal(second.items.length, 3, "two separate custom lines");
});

test("removing the last item is rejected", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 1)]);
  await rejectsWith(edits.removeOrderItem(order._id, order.items[0]._id, { version: order.__v }, USER, tenant._id), 400);
});

test("another tenant's product or variant, or a variant of a different product, is rejected", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 1)]);
  const other = fixtureId();
  const { product: foreign, variant: foreignVariant } = await makeProduct({ owner: other, withVariant: true });
  const { product: mine, variant: myVariant } = await makeProduct({ withVariant: true });
  const { product: sibling } = await makeProduct();

  const add = (item) => edits.addOrderItem(order._id, { version: order.__v, item }, USER, tenant._id);
  await rejectsWith(add({ product: foreign._id, variant: null, quantity: 1 }), 400);
  await rejectsWith(add({ product: mine._id, variant: foreignVariant._id, quantity: 1 }), 400);
  await rejectsWith(add({ product: sibling._id, variant: myVariant._id, quantity: 1 }), 400);
  assert.equal((await Order.findById(order._id)).items.length, 1);
});

// ── Editability ──

test("paid, partially paid, eBay and storefront orders are rejected with 409", async () => {
  const { product } = await makeProduct();
  const add = (o) => edits.addOrderItem(o._id, { version: o.__v, item: customLine }, USER, tenant._id);

  const paid = await makeOrder([line(product, 1)]);
  await orderService.recordOrderPayment(paid._id, { payment_method: "cash", amount: paid.total / 100 }, tenant._id);
  const partial = await makeOrder([line(product, 1)]);
  await orderService.recordOrderPayment(partial._id, { payment_method: "cash", amount: 1 }, tenant._id);
  const ebay = await makeOrder([line(product, 1)], { channel: "ebay" });
  const storefront = await makeOrder([line(product, 1)], { channel: "storefront" });

  for (const order of [paid, partial, ebay, storefront]) {
    const fresh = await Order.findById(order._id);
    await rejectsWith(add(fresh), 409, "not_editable");
  }
  assert.match(await edits.editBlockReason(await Order.findById(ebay._id)), /eBay/);
});

// ── Payment race ──

test("an open requires_payment_method intent is cancelled, then the edit applies", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 1)]);
  const payment = await openIntent(order);

  const updated = await edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id);
  assert.equal(stripe.calls.cancel, 1);
  assert.equal((await Payment.findById(payment._id)).status, "canceled");
  assert.equal(updated.items.length, 2);
});

test("a succeeded intent on a still-pending order is rejected; order, stock and Payment untouched", async () => {
  stripe = fakeStripe({ status: "succeeded" });
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 2)]);
  await openIntent(order);
  const before = await snapshot(order, product);

  await rejectsWith(
    edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 5 }, USER, tenant._id),
    409,
    "payment_in_flight",
  );
  assert.deepEqual(await snapshot(order, product), before);
  assert.equal(stripe.calls.cancel, 0, "never cancels a paid intent");
});

for (const status of ["processing", "requires_capture"]) {
  test(`a ${status} intent is rejected`, async () => {
    stripe = fakeStripe({ status });
    const { product } = await makeProduct();
    const order = await makeOrder([line(product, 1)]);
    await openIntent(order);
    await rejectsWith(edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id), 409, "payment_in_flight");
    assert.equal(stripe.calls.cancel, 0);
  });
}

test("a cancel that throws, unexpected_state included, rejects and leaves the Payment alone", async () => {
  const failures = [
    () => Object.assign(new Error("This PaymentIntent's status is succeeded"), { code: "payment_intent_unexpected_state" }),
    () => new Error("Stripe is down"),
  ];
  for (const failure of failures) {
    stripe = fakeStripe({ status: "requires_action", cancel: async () => { throw failure(); } });
    const { product } = await makeProduct();
    const order = await makeOrder([line(product, 1)]);
    const payment = await openIntent(order);
    const before = await snapshot(order, product);

    await rejectsWith(edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id), 409, "payment_in_flight");
    assert.equal((await Payment.findById(payment._id)).status, "pending");
    assert.deepEqual(await snapshot(order, product), before);
  }
});

test("a cancel Stripe doesn't confirm as canceled is rejected", async () => {
  stripe = fakeStripe({ status: "requires_confirmation", cancel: async () => ({ status: "processing" }) });
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 1)]);
  const payment = await openIntent(order);
  await rejectsWith(edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id), 409, "payment_in_flight");
  assert.equal((await Payment.findById(payment._id)).status, "pending");
});

test("price, discount and shipping edits now run the same guard", async () => {
  stripe = fakeStripe({ status: "succeeded" });
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 2)]);
  await openIntent(order);
  const before = await snapshot(order, product);

  await rejectsWith(edits.updateOrderItemPrice(order._id, 0, { unit_price: 10 }, USER, tenant._id), 409, "payment_in_flight");
  await rejectsWith(edits.updateOrderItemDiscount(order._id, 0, { discount_amount: 5 }, USER, tenant._id), 409, "payment_in_flight");
  await rejectsWith(edits.updateOrderShippingCost(order._id, { shipping_cost: 9 }, USER, tenant._id), 409, "payment_in_flight");
  assert.deepEqual(await snapshot(order, product), before);

  const paid = await makeOrder([line(product, 1)]);
  await orderService.recordOrderPayment(paid._id, { payment_method: "cash", amount: paid.total / 100 }, tenant._id);
  await rejectsWith(edits.updateOrderItemPrice(paid._id, 0, { unit_price: 10 }, USER, tenant._id), 409, "not_editable");
});

test("price, discount and shipping still work on an editable order", async () => {
  const { product } = await makeProduct({ price: 20 });
  let order = await makeOrder([line(product, 2)]);
  order = await edits.updateOrderItemPrice(order._id, 0, { unit_price: 25 }, USER, tenant._id);
  order = await edits.updateOrderItemDiscount(order._id, 0, { discount_amount: 5 }, USER, tenant._id);
  order = await edits.updateOrderShippingCost(order._id, { shipping_cost: 10 }, USER, tenant._id);
  assert.equal(order.items[0].original_unit_price, 2000);
  assert.deepEqual([order.subtotal, order.shipping_cost, order.total], [4500, 1000, 5500]);
});

// ── Concurrency ──

test("a stale version is rejected with 409", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 1)]);
  await edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id);
  await rejectsWith(edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id), 409, "version_conflict");
});

test("a cash payment recorded mid-edit makes the edit fail its version check", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 2)]);
  const before = await stockOf(product);
  // Runs between the edit's checks and its write, like a colleague at the till.
  mock.method(paymentGuard, "releaseOpenPaymentIntent", async () => {
    await orderService.recordOrderPayment(order._id, { payment_method: "cash", amount: 1 }, tenant._id);
  });

  await rejectsWith(
    edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 5 }, USER, tenant._id),
    409,
    "version_conflict",
  );
  const after = await Order.findById(order._id);
  assert.equal(after.items[0].quantity, 2);
  assert.equal(after.status, "partially_paid", "the payment won");
  assert.equal(await stockOf(product), before);
});

// ── Stock ──

test("manual order: increasing deducts the difference and fans out; removing restocks", async () => {
  const { product } = await makeProduct({ stock: 20 });
  await MarketplaceListing.create({ tenant_id: tenant._id, product: product._id, platform: "ebay", state: "active", external_listing_id: `L-${crypto.randomUUID()}` });
  const { product: other } = await makeProduct({ stock: 20 });
  const order = await makeOrder([line(product, 2), line(other, 1)]);
  assert.equal(await stockOf(product), 18, "creation deducted 2");

  fanOuts = [];
  const increased = await edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 5 }, USER, tenant._id);
  assert.equal(await stockOf(product), 15, "only the 3 extra units");
  assert.equal(fanOuts.filter(([platform]) => platform === "ebay").length, 1, "fanned out to the eBay listing");

  await edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: increased.__v, quantity: 1 }, USER, tenant._id);
  assert.equal(await stockOf(product), 19, "decrease restocks 4");

  const current = await Order.findById(order._id);
  await edits.removeOrderItem(order._id, current.items[0]._id, { version: current.__v }, USER, tenant._id);
  assert.equal(await stockOf(product), 20, "removal restocks the last unit");
});

test("custom lines add and remove without touching stock", async () => {
  const { product } = await makeProduct({ stock: 10 });
  const order = await makeOrder([line(product, 1)]);
  const before = await stockOf(product);
  const added = await edits.addOrderItem(order._id, { version: order.__v, item: customLine }, USER, tenant._id);
  await edits.removeOrderItem(order._id, added.items[1]._id, { version: added.__v }, USER, tenant._id);
  assert.equal(await stockOf(product), before);
});

test("a shortfall at deduction flags the order instead of failing", async () => {
  const { product } = await makeProduct({ stock: 5 });
  const order = await makeOrder([line(product, 2)]);
  // Stock drops after the pre-check, as a race would.
  mock.method(paymentGuard, "releaseOpenPaymentIntent", async () => {
    await Inventory.updateOne({ product: product._id }, { $set: { stock_count: 0 } });
  });
  const updated = await edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 4 }, USER, tenant._id);
  assert.equal(updated.has_stock_issue, true);
  assert.match(updated.stock_issue_note, /Oversold/);
});

test("a rejected edit moves no stock", async () => {
  const { product } = await makeProduct({ stock: 10 });
  const order = await makeOrder([line(product, 1)]);
  const before = await stockOf(product);
  await rejectsWith(edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v + 7, quantity: 3 }, USER, tenant._id), 409);
  stripe = fakeStripe({ status: "processing" });
  await openIntent(order);
  await rejectsWith(edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 3 }, USER, tenant._id), 409);
  assert.equal(await stockOf(product), before);
});

// ── Audit ──

test("every successful edit writes one audit note; a rejected edit writes none", async () => {
  const { product } = await makeProduct();
  const order = await makeOrder([line(product, 2)]);
  const notes = async () => (await Order.findById(order._id)).internal_notes.map((n) => n.text);

  const a = await edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 3 }, USER, tenant._id);
  assert.deepEqual(await notes(), [`Qty of ${order.items[0].name} changed 2 → 3 by Sam Staff`]);
  const b = await edits.addOrderItem(order._id, { version: a.__v, item: customLine }, USER, tenant._id);
  await edits.updateOrderShippingCost(order._id, { version: b.__v, shipping_cost: 7.5 }, USER, tenant._id);
  assert.equal((await notes()).length, 3);
  assert.match((await notes())[2], /^Shipping changed A\$0\.00 → A\$7\.50 by Sam Staff$/);

  await rejectsWith(edits.addOrderItem(order._id, { version: 0, item: customLine }, USER, tenant._id), 409);
  assert.equal((await notes()).length, 3);
});

// ── Guest payment page ──

test("guest view: amount_due ignores a cancelled attempt and nets succeeded ones", async () => {
  const { product } = await makeProduct({ price: 40 });
  const order = await makeOrder([line(product, 2)]);
  const attempt = await openIntent(order);
  await Order.updateOne({ _id: order._id }, { $set: { payment: attempt._id } });

  const edited = await edits.updateOrderItemQuantity(order._id, order.items[0]._id, { version: order.__v, quantity: 3 }, USER, tenant._id);
  const { guest_access_token: token } = await Order.findById(order._id).select("+guest_access_token").lean();

  const view = await orderService.getGuestOrderView(order._id, token, tenant._id);
  assert.equal(view.payment.status, "canceled", "the populated payment is the old attempt");
  assert.equal(view.amount_due, edited.total, "the full new total, not total minus the cancelled amount");
  assert.equal(view.guest_access_token, undefined);

  await Payment.create({
    tenant_id: tenant._id, order: order._id, provider: "manual", payment_method: "cash", amount: 1000, currency: "aud", status: "succeeded",
  });
  const partial = await orderService.getGuestOrderView(order._id, token, tenant._id);
  assert.equal(partial.amount_due, edited.total - 1000);
});
