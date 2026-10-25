// services/order.service.invoiceDetails.test.js
// Line chips, account terms, overdue alerts and unpaid counts on orders.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const { trackFixtureTenant } = require("../testUtils/fixtureTenants");
const config = require("../config");

const Tenant = require("../models/Tenant");
const Customer = require("../models/Customer");
const Business = require("../models/Business");
const Product = require("../models/Product");
const Order = require("../models/Order");

const notificationService = require("./notification.service");
const orderService = require("./order.service");
const businessService = require("./business.service");
const orderEditService = require("./order-edit.service");
const overdueService = require("./order-overdue.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const DAY_MS = 24 * 60 * 60 * 1000;

async function createFixtures({ paymentTermsDays = null } = {}) {
  const suffix = crypto.randomUUID();
  const tenant = trackFixtureTenant(
    await Tenant.create({
      name: `Invoice details test ${suffix}`,
      slug: `invoice-details-${suffix}`,
      code: `IDT${suffix.slice(0, 6).toUpperCase()}`,
    }),
  );
  const product = await Product.create({
    tenant_id: tenant._id,
    title: `Used genuine part ${suffix}`,
    slug: `used-genuine-part-${suffix}`,
    sku: `IDT-${suffix}`,
    price: 20,
    status: "active",
    condition: "USED",
    authenticity: "Genuine",
    stock_control: false,
  });
  const business = await Business.create({
    tenant_id: tenant._id,
    name: `Smith Motors ${suffix}`,
    payment_terms_days: paymentTermsDays,
  });
  const customer = await Customer.create({ tenant_id: tenant._id, name: "Owen Beard", business_id: business._id });
  return { tenant, product, business, customer };
}

function createOrder({ tenant, product, customer }) {
  return orderService.createManualOrder(
    {
      customer_id: customer._id,
      items: [{ product: product._id, quantity: 1 }, { is_custom: true, name: "Labour", unit_price: 50 }],
      payment_method: "cash",
    },
    tenant,
  );
}

test("createManualOrder snapshots condition chips and locks business terms", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const fixtures = await createFixtures({ paymentTermsDays: 14 });

  const order = await createOrder(fixtures);
  const [catalogue, custom] = order.items;
  assert.equal(catalogue.condition, "USED");
  assert.equal(catalogue.authenticity, "Genuine");
  assert.equal(custom.condition, null);
  assert.equal(order.payment_terms_days, 14);
  assert.ok(Math.abs(order.due_date - order.created_at - 14 * DAY_MS) < 2 * 60 * 60 * 1000);

  // A later change to the business leaves the issued invoice's terms alone.
  await businessService.updateBusiness(fixtures.business._id, fixtures.tenant._id, {
    name: fixtures.business.name,
    payment_terms_days: 30,
  });
  const persisted = await Order.findById(order._id).lean();
  assert.equal(persisted.payment_terms_days, 14);
});

test("createManualOrder without business terms stays due on receipt", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const order = await createOrder(await createFixtures());
  assert.equal(order.payment_terms_days, null);
  assert.equal(order.due_date, null);
});

test("order detail fills chips on pre-snapshot lines from the product", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const fixtures = await createFixtures();
  const order = await createOrder(fixtures);
  await Order.updateOne({ _id: order._id }, { $set: { "items.0.condition": null, "items.0.authenticity": null } });

  const detail = await orderService.getOrderDetailForAdmin(order._id, fixtures.tenant._id);
  assert.equal(detail.items[0].condition, "USED");
  assert.equal(detail.items[0].authenticity, "Genuine");
  assert.equal(detail.items[1].condition, null);
});

test("custom lines keep optional chips and their details stay editable once paid", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const { tenant, customer } = await createFixtures();
  const order = await orderService.createManualOrder(
    {
      customer_id: customer._id,
      items: [{ is_custom: true, name: "Gearbox", unit_price: 300, condition: "USED", authenticity: null }],
      payment_method: "cash",
      amount_paid: 300,
    },
    tenant,
  );
  const [line] = order.items;
  assert.equal(order.payment_status, "paid");
  assert.equal(line.condition, "USED");
  assert.equal(line.authenticity, null);

  const user = { id: null, name: "Staff" };
  const details = { name: "Gearbox (rebuilt)", condition: "USED", authenticity: "Genuine" };
  const updated = await orderEditService.updateCustomItemDetails(
    order._id, line._id, { version: order.__v, ...details }, user, tenant._id,
  );
  assert.equal(updated.items[0].name, "Gearbox (rebuilt)");
  assert.equal(updated.items[0].authenticity, "Genuine");
  assert.equal(updated.total, order.total);
  assert.match(updated.internal_notes.at(-1).text, /authenticity none → Genuine/);

  await assert.rejects(
    orderEditService.updateCustomItemDetails(order._id, line._id, { version: order.__v, ...details, name: "x" }, user, tenant._id),
    (err) => err.status === 409,
  );
});

test("a cancelled unpaid order no longer counts as unpaid", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  t.after(() => notifySpy.mock.restore());
  const fixtures = await createFixtures();
  const order = await createOrder(fixtures);
  const before = await orderService.getOrderStats(fixtures.tenant._id);
  await orderService.updateOrderStatus(order._id, { status: "cancelled" }, fixtures.tenant._id);

  const after = await orderService.getOrderStats(fixtures.tenant._id);
  assert.equal(after.unpaidCount, before.unpaidCount - 1);
  const unpaidList = await orderService.listOrders({ payment_status: "pending_payment" }, fixtures.tenant._id);
  assert.equal(unpaidList.items.some((o) => String(o._id) === String(order._id)), false);
});

test("overdue sweep alerts once per overdue account invoice", async (t) => {
  const notifySpy = mock.method(notificationService, "notifyNewOrder", async () => {});
  const overdueSpy = mock.method(notificationService, "notifyInvoicesOverdue", async () => {});
  t.after(() => {
    notifySpy.mock.restore();
    overdueSpy.mock.restore();
  });
  const fixtures = await createFixtures({ paymentTermsDays: 7 });
  const order = await createOrder(fixtures);
  // Year-2000 dates keep every real order out of this sweep's window.
  await Order.updateOne({ _id: order._id }, { $set: { due_date: new Date("2000-01-01") } });
  const now = new Date("2000-01-02");

  assert.equal((await overdueService.sweepOverdueInvoices(now)).notified, 1);
  const [tenantId, orders] = overdueSpy.mock.calls[0].arguments;
  assert.equal(String(tenantId), String(fixtures.tenant._id));
  assert.equal(orders[0].order_number, order.order_number);
  assert.ok((await Order.findById(order._id).lean()).overdue_notified_at);

  assert.equal((await overdueService.sweepOverdueInvoices(now)).notified, 0);
});
