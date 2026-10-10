// routes/channels.meta.test.js
// GET /channels lists all three; Meta needs a verified storefront domain.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const { useMetaTestConfig } = require("../testUtils/metaFixtures");

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Domain = require("../models/Domain");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

let server;
let baseUrl;
let restoreConfig;

async function makeTenantUser({ verifiedDomain }) {
  const id = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: id, name: `Meta ${suffix}`, slug: `meta-${suffix}`, code: `ME${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(id);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: id, first_name: "Me", last_name: "Ta", email: `meta-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId: id, userId: insertedId, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
  if (verifiedDomain) {
    await Domain.create({ tenant_id: id, hostname: `meta-${suffix}.example.com`, status: "active", is_default: true, verification_token: suffix });
  }
  return signJwt({ sub: String(insertedId), role: "user" });
}

async function get(path, token) {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  restoreConfig = useMetaTestConfig();
  await mongoose.connect(config.mongoUri);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  restoreConfig();
  server.close();
  await mongoose.disconnect();
});

test("GET /channels: eBay, Google and Meta; Meta unavailable without a verified domain", async () => {
  const token = await makeTenantUser({ verifiedDomain: false });
  const { status, body } = await get("/channels", token);
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((c) => c.key), ["ebay", "google", "meta"]);
  const meta = body.data.find((c) => c.key === "meta");
  assert.equal(meta.available, false);
  assert.match(meta.unavailable_reason, /Meta requires a verified storefront domain/);
  assert.equal(meta.capabilities.asyncPublish, true);
  assert.equal(meta.connection.status, "disconnected");
  assert.equal(body.data.find((c) => c.key === "ebay").available, true);

  const connect = await get("/meta/oauth/connect-url", token);
  assert.equal(connect.status, 400, "connect refuses a tenant Meta can't link shoppers back to");
});

test("GET /channels: Meta available with a verified default domain", async () => {
  const token = await makeTenantUser({ verifiedDomain: true });
  const { body } = await get("/channels", token);
  const meta = body.data.find((c) => c.key === "meta");
  assert.equal(meta.available, true);
  assert.equal(meta.unavailable_reason, null);
  const connect = await get("/meta/oauth/connect-url", token);
  assert.equal(connect.status, 200);
  assert.match(connect.body.data.url, /\/dialog\/oauth\?.*config_id=cfg-1/);
});
