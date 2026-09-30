// services/refund.service.custom-lines.test.js
// Custom lines never get stock/listing flags or restock. Needs Mongo.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");
const Inventory = require("../models/Inventory");
const MarketplaceListing = require("../models/MarketplaceListing");
const refundService = require("./refund.service");

const TEST_TENANT_ID = fixtureId();

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const CUSTOM_LINE = {
  product: null,
  variant: null,
  is_custom: true,
  name: "Fitting labour",
  sku: null,
  unit_price: 5000,
  quantity: 2,
  discount_amount: 0,
};

async function createPaidOrder(items) {
  const suffix = crypto.randomUUID();
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const order = await Order.create({
    tenant_id: TEST_TENANT_ID,
    order_number: `TEST-CUSTOM-${suffix}`,
    invoice_number: `TEST-CUSTOM-INV-${suffix}`,
    items,
    customer: { name: "Custom Line Refund Test", email: null, phone: null },
    delivery_method: "pickup",
    subtotal,
    shipping_cost: 0,
    tax_amount: Math.round(subtotal / 11),
    total: subtotal,
    currency: "aud",
    channel: "manual",
    payment_status: "paid",
    fulfillment_status: "pending",
    guest_access_token: crypto.randomBytes(16).toString("hex"),
  });
  await Payment.create({
    tenant_id: TEST_TENANT_ID,
    order: order._id,
    provider: "manual",
    payment_method: "cash",
    amount: order.total,
    amount_refunded: 0,
    currency: "aud",
    status: "succeeded",
    paid_at: new Date(),
  });
  return order;
}

// Chainable stand-in for Model.find(...).select(...).lean().
function findReturning(docs) {
  return () => ({ select: () => ({ lean: async () => docs }) });
}

test("refund summary: a custom line has no stock/listing flags; real lines keep theirs", async (t) => {
  const productId = fixtureId();
  const locationId = fixtureId();
  await Inventory.create({ product: productId, variant: null, location: locationId, stock_count: 5 });
  const order = await createPaidOrder([
    { product: productId, variant: null, name: "Catalogue part", sku: `CL-${crypto.randomUUID()}`, unit_price: 2000, quantity: 1, discount_amount: 0 },
    CUSTOM_LINE,
  ]);
  t.after(() => Inventory.deleteMany({ product: productId }));

  const summary = await refundService.getRefundableSummary(order._id.toString(), TEST_TENANT_ID);
  const [catalogueLine, customLine] = summary.lines;
  assert.equal(catalogueLine.has_inventory_record, true, "real lines must still be flagged");
  assert.equal(customLine.has_inventory_record, false);
  assert.equal(customLine.has_ebay_listing, false);
});

test("refund summary: a null-product stock/listing doc can never match a custom line", async (t) => {
  // Simulates Inventory/MarketplaceListing.product ever becoming optional.
  const nullDoc = [{ product: null, variant: null }];
  const invSpy = mock.method(Inventory, "find", findReturning(nullDoc));
  const listingSpy = mock.method(MarketplaceListing, "find", findReturning(nullDoc));
  t.after(() => {
    invSpy.mock.restore();
    listingSpy.mock.restore();
  });
  const order = await createPaidOrder([
    { product: fixtureId(), variant: null, name: "Catalogue part", sku: null, unit_price: 2000, quantity: 1, discount_amount: 0 },
    CUSTOM_LINE,
  ]);

  const summary = await refundService.getRefundableSummary(order._id.toString(), TEST_TENANT_ID);
  const customLine = summary.lines[1];
  assert.equal(customLine.has_inventory_record, false);
  assert.equal(customLine.has_ebay_listing, false);
});

test("refund summary: an order of only custom lines runs no stock/listing queries", async (t) => {
  const invSpy = mock.method(Inventory, "find", findReturning([]));
  const listingSpy = mock.method(MarketplaceListing, "find", findReturning([]));
  t.after(() => {
    invSpy.mock.restore();
    listingSpy.mock.restore();
  });
  const order = await createPaidOrder([CUSTOM_LINE, { ...CUSTOM_LINE, name: "Freight extra", quantity: 1 }]);

  const summary = await refundService.getRefundableSummary(order._id.toString(), TEST_TENANT_ID);
  assert.ok(summary.lines.every((l) => !l.has_inventory_record && !l.has_ebay_listing));
  assert.equal(invSpy.mock.calls.length, 0);
  assert.equal(listingSpy.mock.calls.length, 0);
});

test("createRefund: restock requested on a custom line is never applied", async () => {
  const order = await createPaidOrder([CUSTOM_LINE]);
  const itemId = order.items[0]._id.toString();

  const refund = await refundService.createRefund(
    order._id.toString(),
    {
      idempotency_key: `custom-restock-${order._id}`,
      scope: "line_items",
      lines: [{ order_item_id: itemId, quantity: 1, restock: true }],
      reason: "customer_request",
    },
    null,
    TEST_TENANT_ID,
  );

  assert.equal(refund.total_amount, 5000);
  assert.equal(refund.lines.length, 1);
  assert.equal(refund.lines[0].restock, false, "a custom line has no SKU, so restock is off");
  const fresh = await Order.findById(order._id).lean();
  assert.equal(fresh.items[0].quantity_restocked, 0);
  assert.equal(await Refund.countDocuments({ order: order._id }), 1);
});
