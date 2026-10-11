// routes/channels.meta.test.js
// GET /channels lists all three; Meta needs a verified storefront domain.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
const { useMetaTestConfig, jsonResponse } = require("../testUtils/metaFixtures");

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Domain = require("../models/Domain");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");
const ChannelConnection = require("../models/ChannelConnection");
const channelService = require("../services/marketplace/channel.service");
const metaOauth = require("../services/meta/meta.oauth.service");

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
  return { token: signJwt({ sub: String(insertedId), role: "user" }), tenantId: id };
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
afterEach(() => mock.restoreAll());
after(async () => {
  restoreConfig();
  server.close();
  await mongoose.disconnect();
});

test("GET /channels: eBay, Google and Meta; Meta unavailable without a verified domain", async () => {
  const { token } = await makeTenantUser({ verifiedDomain: false });
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
  const { token } = await makeTenantUser({ verifiedDomain: true });
  const { body } = await get("/channels", token);
  const meta = body.data.find((c) => c.key === "meta");
  assert.equal(meta.available, true);
  assert.equal(meta.unavailable_reason, null);
  const connect = await get("/meta/oauth/connect-url", token);
  assert.equal(connect.status, 200);
  assert.match(connect.body.data.url, /\/dialog\/oauth\?.*config_id=cfg-1/);
});

const realFetch = global.fetch;
// Stubs Graph only; requests to this test server still go through.
function stubGraph(routes) {
  mock.method(global, "fetch", async (url, opts) => {
    const u = String(url);
    if (u.startsWith(baseUrl)) return realFetch(url, opts);
    const route = routes.find(([re]) => re.test(u));
    return route ? route[1](u) : jsonResponse(404, { error: { code: 100, message: "unhandled" } });
  });
}
const debugToken = (targetIds) => () =>
  jsonResponse(200, { data: { type: "SYSTEM_USER", granular_scopes: [{ scope: "catalog_management", target_ids: targetIds }] } });
const catalogNode = (url) => jsonResponse(200, { id: new URL(url).pathname.split("/").pop(), name: `Catalog ${new URL(url).pathname.split("/").pop()}` });

async function callback(tenantId) {
  const state = new URL(metaOauth.buildConsentUrl({ tenantId })).searchParams.get("state");
  const res = await fetch(`${baseUrl}/meta/oauth/callback?code=abc&state=${encodeURIComponent(state)}`, { redirect: "manual" });
  return new URL(res.headers.get("location")).searchParams.get("meta_connect");
}

test("callback: one granted catalog connects straight away and starts the first sync", async () => {
  const { tenantId } = await makeTenantUser({ verifiedDomain: true });
  const fullSync = mock.method(channelService, "enqueueFullSync", async () => true);
  stubGraph([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken(["555"])],
    [/\/555\?/, catalogNode],
    [/\/me\?/, () => jsonResponse(200, { id: "su1", client_business_id: "111" })],
  ]);
  assert.equal(await callback(tenantId), "success");
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean();
  assert.equal(conn.status, "connected");
  assert.equal(conn.catalog_id, "555");
  assert.deepEqual(fullSync.mock.calls[0].arguments.map(String), ["meta", String(tenantId)]);
});

test("callback + picker: several granted catalogs are listed with names", async () => {
  const { token, tenantId } = await makeTenantUser({ verifiedDomain: true });
  stubGraph([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken(["555", "666"])],
    [/\/(555|666)\?/, catalogNode],
  ]);
  assert.equal(await callback(tenantId), "choose_catalog");
  const res = await fetch(`${baseUrl}/meta/oauth/catalogs`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data.catalogs, [{ id: "555", name: "Catalog 555" }, { id: "666", name: "Catalog 666" }]);
});

test("picker: a Graph permission error comes back as an error with Meta's code", async () => {
  const { token, tenantId } = await makeTenantUser({ verifiedDomain: true });
  stubGraph([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, () => jsonResponse(200, { data: { type: "SYSTEM_USER" } })],
    [/assigned_product_catalogs/, () => jsonResponse(403, { error: { code: 200, message: "(#200) Permissions error" } })],
  ]);
  assert.equal(await callback(tenantId), "choose_catalog", "the picker shows the error with a reconnect");
  const res = await fetch(`${baseUrl}/meta/oauth/catalogs`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.match(body.message, /\(code 200\)/);
  assert.notEqual(body.reason, "no_catalog_granted");
});
