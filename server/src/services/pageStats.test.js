// services/pageStats.test.js
// Inventory and customer page counts, on fixture tenants only. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const { getInventoryStats } = require("./inventory.service");
const { getCustomerStats } = require("./customer.service");
const { ORDER_STATUS } = require("../constants/order.constants");

const created = { products: [], inventory: [], customers: [], orders: [] };

before(() => mongoose.connect(config.mongoUri));
after(async () => {
  await Promise.all([
    Product.collection.deleteMany({ _id: { $in: created.products } }),
    Inventory.collection.deleteMany({ _id: { $in: created.inventory } }),
    Customer.collection.deleteMany({ _id: { $in: created.customers } }),
    Order.collection.deleteMany({ _id: { $in: created.orders } }),
  ]);
  await mongoose.disconnect();
});

// Unique per document, for the slug and order/invoice number indexes.
const uid = () => crypto.randomUUID();

async function insert(Model, bucket, doc) {
  const { insertedId } = await Model.collection.insertOne(doc);
  created[bucket].push(insertedId);
  return insertedId;
}

test("inventory stats: stock summed across locations, then bucketed", async () => {
  const tenantId = fixtureId();
  const product = (title) => insert(Product, "products", { tenant_id: tenantId, title, slug: uid(), deleted_at: null });
  const stock = (productId, count) =>
    insert(Inventory, "inventory", { product: productId, variant: null, location: new mongoose.Types.ObjectId(), stock_count: count });

  const healthy = await product("healthy");
  await stock(healthy, 20);
  await stock(healthy, 5);
  const low = await product("low");
  await stock(low, 2);
  const out = await product("out");
  await stock(out, 0);
  const deleted = await insert(Product, "products", { tenant_id: tenantId, title: "gone", slug: uid(), deleted_at: new Date() });
  await stock(deleted, 50);

  assert.deepEqual(await getInventoryStats(tenantId, 3), {
    trackedItems: 3,
    unitsInStock: 27,
    lowStockCount: 1,
    outOfStockCount: 1,
    lowStockThreshold: 3,
  });
});

test("customer stats: totals, online, new this month, unpaid customers", async () => {
  const tenantId = fixtureId();
  const customer = (extra) =>
    insert(Customer, "customers", { tenant_id: tenantId, name: "C", has_online_account: false, deleted_at: null, created_at: new Date(), ...extra });
  const a = await customer({ has_online_account: true });
  const b = await customer({ created_at: new Date("2020-01-01") });
  await customer({ deleted_at: new Date() });
  const order = (customerId, status) =>
    insert(Order, "orders", { tenant_id: tenantId, customer_id: customerId, status, order_number: uid(), invoice_number: uid() });
  await order(a, ORDER_STATUS.PENDING_PAYMENT);
  await order(a, ORDER_STATUS.PARTIALLY_PAID);
  await order(b, ORDER_STATUS.PAID);

  assert.deepEqual(await getCustomerStats(tenantId), {
    totalCustomers: 2,
    onlineAccounts: 1,
    newThisMonth: 1,
    withUnpaidInvoices: 1,
  });
});
