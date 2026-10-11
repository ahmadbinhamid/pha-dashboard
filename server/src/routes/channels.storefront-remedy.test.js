// routes/channels.storefront-remedy.test.js
// Unavailable channels link to Custom Domains; a default domain unlocks them.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

const DOMAINS_HREF = "/settings/integrations/domains";
const STOREFRONT_CHANNELS = ["google", "meta"];

let server;
let baseUrl;

async function makeTenantUser() {
  const id = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: id, name: `Remedy ${suffix}`, slug: `remedy-${suffix}`, code: `RM${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(id);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: id, first_name: "Re", last_name: "Medy", email: `remedy-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId: id, userId: insertedId, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
  return signJwt({ sub: String(insertedId), role: "user" });
}

async function call(token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const channelsByKey = async (token) => new Map((await call(token, "GET", "/channels")).body.data.map((c) => [c.key, c]));

before(async () => {
  await mongoose.connect(config.mongoUri);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});
afterEach(() => mock.restoreAll());

test("Google and Meta notices name Custom Domains and carry a link to it", async () => {
  const channels = await channelsByKey(await makeTenantUser());
  for (const key of STOREFRONT_CHANNELS) {
    const channel = channels.get(key);
    assert.equal(channel.available, false, key);
    assert.match(channel.unavailable_reason, /Settings › Integrations › Custom Domains/, key);
    assert.doesNotMatch(channel.unavailable_reason, /Settings > Domains/, key);
    assert.deepEqual(channel.unavailable_action, { label: "Open Custom Domains", href: DOMAINS_HREF }, key);
  }
  assert.equal(channels.get("ebay").available, true);
  assert.equal(channels.get("ebay").unavailable_action, null);
});

test("Domains: list, add, unverified can't be default, verified default unlocks channels", async () => {
  const token = await makeTenantUser();
  const hostname = `remedy-${crypto.randomUUID().slice(0, 8)}.example.com`;

  const added = await call(token, "POST", "/domains", { hostname });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  const domain = added.body.data;
  assert.equal(domain.status, "pending");

  const listed = await call(token, "GET", "/domains");
  assert.deepEqual(listed.body.data.map((d) => d.hostname), [hostname]);

  const early = await call(token, "PUT", `/domains/${domain._id}/default`);
  assert.equal(early.status, 400);
  assert.match(early.body.message, /Only a verified domain/);
  assert.equal((await channelsByKey(token)).get("meta").available, false);

  // DNS stubbed in-process: the TXT record holds this domain's own token.
  mock.method(dns, "resolveTxt", async () => [[domain.verification_token]]);
  const verified = await call(token, "POST", `/domains/${domain._id}/verify`);
  assert.equal(verified.status, 200, JSON.stringify(verified.body));

  const made = await call(token, "PUT", `/domains/${domain._id}/default`);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const [stored] = (await call(token, "GET", "/domains")).body.data;
  assert.equal(stored.status, "active");
  assert.equal(stored.is_default, true);

  const channels = await channelsByKey(token);
  for (const key of STOREFRONT_CHANNELS) {
    assert.equal(channels.get(key).available, true, key);
    assert.equal(channels.get(key).unavailable_reason, null, key);
    assert.equal(channels.get(key).unavailable_action, null, key);
  }
});
