// routes/order.edit.routes.test.js
// Line-edit routes: auth, validation, detail shape and the 409 contract.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");

const channelQueue = require("../queues/channel.queue");
mock.method(channelQueue, "enqueueChannelJob", async () => {});
const stripeKeysService = require("../services/stripe/stripe.keys.service");
let intentStatus = "succeeded";
mock.method(stripeKeysService, "getStripeClient", async () => ({
  paymentIntents: { retrieve: async (id) => ({ id, status: intentStatus }), cancel: async () => ({ status: "canceled" }) },
}));

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const Role = require("../models/Role");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const orderService = require("../services/order.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

let server;
let baseUrl;
let tenant;
let adminToken;
let staffToken;

before(async () => {
  await mongoose.connect(config.mongoUri);
  const id = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  tenant = { _id: id, order_number_prefix: "TST", invoice_number_prefix: "TIN" };
  await mongoose.connection.collection("tenants").insertOne({
    _id: id, name: `Route ${suffix}`, slug: `route-${suffix}`, code: `RT${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(id);
  // A view-only role, since Staff holds orders.update by default.
  roles.Viewer = await Role.create({ tenant_id: id, name: `Viewer ${suffix}`, permissions: ["orders.view"], is_system: false });
  const makeUser = async (role, first) => {
    const { insertedId } = await User.collection.insertOne({
      tenant_id: id, first_name: first, last_name: "Tester", email: `${first}-${suffix}@example.com`,
      password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
    });
    await addMember({ tenantId: id, userId: insertedId, roleId: roles[role]._id });
    return signJwt({ sub: String(insertedId), role: "user" });
  };
  adminToken = await makeUser(SYSTEM_ROLE.ADMIN, "Ada");
  staffToken = await makeUser("Viewer", "Vic");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/order`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});

async function call(method, path, body, token = adminToken) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function makeOrder() {
  const customer = await Customer.create({ tenant_id: tenant._id, name: "Walk-in", email: `c-${crypto.randomUUID()}@example.com` });
  return orderService.createManualOrder(
    { customer_id: customer._id, items: [{ is_custom: true, name: "Labour", unit_price: 40, quantity: 1 }], payment_method: "payment_link" },
    tenant,
  );
}

const custom = { is_custom: true, name: "Fitting", unit_price: 15, quantity: 2 };

test("detail carries version and edit_block_reason; edits answer with the refreshed detail", async () => {
  const order = await makeOrder();
  const detail = await call("GET", `/${order._id}/detail`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.version, 0);
  assert.equal(detail.body.data.edit_block_reason, null);

  const added = await call("POST", `/${order._id}/items`, { version: 0, item: custom });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(added.body.data.version, 1);
  assert.equal(added.body.data.total, 7000);
  assert.ok(Array.isArray(added.body.data.payments));

  const itemId = added.body.data.items[1]._id;
  const qty = await call("PATCH", `/${order._id}/items/${itemId}/quantity`, { version: 1, quantity: 3 });
  assert.equal(qty.body.data.total, 8500);
  const removed = await call("DELETE", `/${order._id}/items/${itemId}?version=2`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.items.length, 1);
});

test("a missing version is a 400; a user without orders.update gets 403", async () => {
  const order = await makeOrder();
  assert.equal((await call("POST", `/${order._id}/items`, { item: custom })).status, 400);
  assert.equal((await call("DELETE", `/${order._id}/items/${order.items[0]._id}`)).status, 400);
  assert.equal((await call("POST", `/${order._id}/items`, { version: 0, item: custom }, staffToken)).status, 403);
});

test("409s use the existing shape, with jsonerr.code naming the conflict", async () => {
  const order = await makeOrder();
  const stale = await call("POST", `/${order._id}/items`, { version: 5, item: custom });
  assert.equal(stale.status, 409);
  assert.deepEqual(Object.keys(stale.body).sort(), ["jsonerr", "message", "status", "systemfailure"]);
  assert.equal(stale.body.jsonerr.code, "version_conflict");

  await Payment.create({
    tenant_id: tenant._id, order: order._id, provider: "stripe", stripe_payment_intent_id: `pi_${crypto.randomUUID()}`,
    amount: order.total, currency: "aud", status: "pending",
  });
  intentStatus = "succeeded";
  const paying = await call("PATCH", `/${order._id}/shipping-cost`, { shipping_cost: 5 });
  assert.equal(paying.status, 409);
  assert.equal(paying.body.jsonerr.code, "payment_in_flight");
  assert.equal(paying.body.message, "A payment has been received or is in progress for this order.");
});
