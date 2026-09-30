// services/order.service.customItems.test.js
// Custom order-only lines: totals, no stock effect, reports tolerate them.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const { trackFixtureTenant } = require("../testUtils/fixtureTenants");
const config = require("../config");

const Tenant = require("../models/Tenant");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Location = require("../models/Location");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const Order = require("../models/Order");

const notificationService = require("./notification.service");
const orderService = require("./order.service");
const reportsService = require("./reports.service");
const { createManualOrder: manualOrderValidation } = require("../validators/order.validation");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function createFixtures() {
  const suffix = crypto.randomUUID();
  const tenant = trackFixtureTenant(
    await Tenant.create({
      name: `Custom items test ${suffix}`,
      slug: `custom-items-${suffix}`,
      code: `CIT${suffix.slice(0, 6).toUpperCase()}`,
    }),
  );
  const location = await Location.create({ tenant_id: tenant._id, name: `Loc ${suffix}` });
  const product = await Product.create({
    tenant_id: tenant._id,
    title: `Catalogue part ${suffix}`,
    slug: `catalogue-part-${suffix}`,
    sku: `CIT-${suffix}`,
    price: 20,
    shipping_cost: 4,
    status: "active",
    stock_control: true,
  });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 10 });
  const customer = await Customer.create({ tenant_id: tenant._id, name: "Custom Items Customer" });
  return { tenant, product, customer };
}

test("createManualOrder: custom lines are priced, shipped and never touch stock", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const { tenant, product, customer } = await createFixtures();

  const order = await orderService.createManualOrder(
    {
      customer_id: customer._id,
      items: [
        { product: product._id, quantity: 2 },
        { is_custom: true, name: "Fitting labour", unit_price: 50, shipping_cost: 5, quantity: 3, discount_amount: 10 },
        { is_custom: true, name: "Freight extra", unit_price: 12.5 },
      ],
      delivery_method: "delivery",
      shipping_address: { address: "1 Test St", suburb: "Testville", state: "VIC", postcode: "3000" },
      payment_method: "cash",
    },
    tenant,
  );

  const persisted = await Order.findById(order._id).lean();
  const [catalogue, labour, freight] = persisted.items;
  assert.equal(catalogue.is_custom, false);
  assert.equal(String(catalogue.product), String(product._id));
  assert.equal(labour.is_custom, true);
  assert.equal(labour.product, null);
  assert.equal(labour.sku, null);
  assert.equal(labour.unit_price, 5000);
  assert.equal(labour.discount_amount, 1000);
  assert.equal(freight.quantity, 1);
  assert.equal(freight.unit_price, 1250);

  // 2x$20 + (3x$50 - $10) + $12.50; shipping 2x$4 + 3x$5 + 0.
  assert.equal(persisted.subtotal, 4000 + 14000 + 1250);
  assert.equal(persisted.shipping_cost, 800 + 1500);
  assert.equal(persisted.total, 19250 + 2300);

  const inventory = await Inventory.findOne({ product: product._id }).lean();
  assert.equal(inventory.stock_count, 8, "only the catalogue line deducts stock");
  const history = await InventoryHistory.find({ product: { $in: [null, product._id] } }).lean();
  assert.ok(history.every((h) => String(h.product) === String(product._id)));

  const summary = await reportsService.getSummary(tenant._id, { days: 1 });
  assert.equal(summary.revenueCents, persisted.total);
  assert.equal(summary.itemsSold, 6);
});

test("createManualOrder: a custom discount above the line subtotal is rejected", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const { tenant, customer } = await createFixtures();

  await assert.rejects(
    orderService.createManualOrder(
      {
        customer_id: customer._id,
        items: [{ is_custom: true, name: "Too cheap", unit_price: 10, quantity: 1, discount_amount: 11 }],
        payment_method: "cash",
      },
      tenant,
    ),
    { status: 400 },
  );
  assert.equal(await Order.countDocuments({ tenant_id: tenant._id }), 0);
});

test("createManualOrder validator: custom lines need a title and a price", () => {
  const base = { customer_id: new mongoose.Types.ObjectId().toHexString(), payment_method: "cash" };
  const validate = (items) => manualOrderValidation.body.validate({ ...base, items }).error?.message;

  assert.equal(validate([{ is_custom: true, name: "Labour", unit_price: 50 }]), undefined);
  assert.match(validate([{ is_custom: true, unit_price: 50 }]), /name/);
  assert.match(validate([{ is_custom: true, name: "Labour" }]), /unit_price/);
  assert.match(validate([{ is_custom: true, name: "Labour", unit_price: 0 }]), /unit_price/);
  assert.match(validate([{ quantity: 1 }]), /product/);
});
