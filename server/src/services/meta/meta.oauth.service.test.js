// services/meta/meta.oauth.service.test.js
// Login for Business URL, code exchange, catalog pick, env invariants.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const { useMetaTestConfig, jsonResponse } = require("../../testUtils/metaFixtures");
const { logger } = require("../../loaders/logging");

const ChannelConnection = require("../../models/ChannelConnection");
const oauth = require("./meta.oauth.service");
const { appSecretProof, graphBaseUrl } = require("./meta.graph-api.service");

let restoreConfig;
before(async () => {
  restoreConfig = useMetaTestConfig();
  await mongoose.connect(config.mongoUri);
});
after(async () => {
  restoreConfig();
  await mongoose.disconnect();
});
afterEach(() => mock.restoreAll());

function stubFetch(routes) {
  const seen = [];
  mock.method(global, "fetch", async (url, opts) => {
    seen.push({ url: String(url), opts });
    const route = routes.find(([re]) => re.test(String(url)));
    return route ? route[1](String(url), opts) : jsonResponse(404, { error: { code: 100, message: "unhandled" } });
  });
  return seen;
}

test("consent URL uses config_id with the code flow, signed state, pinned version", () => {
  const url = new URL(oauth.buildConsentUrl({ tenantId: "t1" }));
  assert.equal(url.pathname, `/${config.meta.graphVersion}/dialog/oauth`);
  assert.equal(url.searchParams.get("config_id"), "cfg-1");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("override_default_response_type"), "true");
  assert.equal(url.searchParams.has("scope"), false, "scope is not combined with config_id");
  assert.equal(oauth.resolveState(url.searchParams.get("state")).tenantId, "t1");
});

test("appsecret_proof is the hex HMAC-SHA256 of the token", () => {
  const expected = crypto.createHmac("sha256", "secret-1").update("tok").digest("hex");
  assert.equal(appSecretProof("tok"), expected);
});

test("base URL is computed per call from config", () => {
  const saved = config.meta.graphVersion;
  config.meta.graphVersion = "v99.0";
  try {
    assert.equal(graphBaseUrl(), `${config.meta.graphHost}/v99.0`);
  } finally {
    config.meta.graphVersion = saved;
  }
});

test("callback saves an encrypted PENDING token; a non-expiring token stores no expiry", async () => {
  const tenantId = fixtureId();
  stubFetch([[/oauth\/access_token/, () => jsonResponse(200, { access_token: "sys-user-token", token_type: "bearer" })]]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).select("+access_token_ct").lean();
  assert.equal(conn.status, "pending");
  assert.equal(conn.token_expires_at, null);
  assert.ok(!conn.access_token_ct.includes("sys-user-token"), "token stored encrypted");
  assert.equal(oauth.getAccessToken(conn), "sys-user-token");
});

test("a dated token stores its expiry and is flagged near expiry", async () => {
  const tenantId = fixtureId();
  stubFetch([[/oauth\/access_token/, () => jsonResponse(200, { access_token: "t", expires_in: 3 * 24 * 3600 })]]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean();
  assert.ok(conn.token_expires_at > new Date());
  assert.equal(oauth.isTokenNearExpiry(conn), true);
});

const debugToken = (grants) => () => jsonResponse(200, { data: { type: "SYSTEM_USER", is_valid: true, scopes: ["catalog_management"], ...grants } });
const catalogNode = (url) => {
  const id = new URL(url).pathname.split("/").pop();
  return jsonResponse(200, { id, name: `Catalog ${id}` });
};

test("debug_token with one catalog: auto-selected, named, saved as CONNECTED", async () => {
  const tenantId = fixtureId();
  const seen = stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken({ granular_scopes: [{ scope: "catalog_management", target_ids: ["555"] }] })],
    [/\/me\?/, () => jsonResponse(200, { id: "su1", client_business_id: "111" })],
    [/\/555\?/, catalogNode],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  await oauth.connectSingleGrantedCatalog(tenantId);
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean();
  assert.equal(conn.status, "connected");
  assert.equal(conn.catalog_id, "555");
  assert.equal(conn.catalog_name, "Catalog 555");
  assert.equal(conn.business_id, "111");
  const debugCall = new URL(seen.find((c) => /debug_token/.test(c.url)).url);
  assert.equal(debugCall.searchParams.get("access_token"), "app-1|secret-1", "debug_token uses the app access token");
  assert.ok(!seen.some((c) => /owned_product_catalogs|client_product_catalogs|me\/businesses|\/111\?/.test(c.url)), "no business_management call");
});

test("debug_token with several catalogs: listed with names, nothing auto-selected", async () => {
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken({ granular_scopes: [{ scope: "catalog_management", target_ids: ["555", "666"] }] })],
    [/\/(555|666)\?/, catalogNode],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  assert.equal(await oauth.connectSingleGrantedCatalog(tenantId), null);
  assert.deepEqual(await oauth.listGrantedCatalogs(tenantId), [{ id: "555", name: "Catalog 555" }, { id: "666", name: "Catalog 666" }]);
  assert.equal((await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean()).status, "pending");
});

test("no granular_scopes (system-user token): the assigned-catalogs edge is used", async () => {
  const tenantId = fixtureId();
  const seen = stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken({})],
    [/assigned_product_catalogs/, () => jsonResponse(200, { data: [{ id: "777", name: "Granted" }] })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  assert.deepEqual(await oauth.listGrantedCatalogs(tenantId), [{ id: "777", name: "Granted" }]);
  const fields = new URL(seen.find((c) => /assigned_product_catalogs/.test(c.url)).url).searchParams.get("fields");
  assert.equal(fields, "id,name", "a business{} sub-field would need business_management");
});

for (const [label, grants] of [
  ["no catalog_management entry", { granular_scopes: [{ scope: "public_profile" }] }],
  ["empty target_ids", { granular_scopes: [{ scope: "catalog_management", target_ids: [] }] }],
]) {
  test(`${label} and nothing assigned: the no-catalog message`, async () => {
    const tenantId = fixtureId();
    stubFetch([
      [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
      [/debug_token/, debugToken(grants)],
      [/assigned_product_catalogs/, () => jsonResponse(200, { data: [] })],
    ]);
    await oauth.savePendingConnection({ tenantId, code: "abc" });
    await assert.rejects(oauth.listGrantedCatalogs(tenantId), (err) => {
      assert.equal(err.code, "NO_CATALOG_GRANTED");
      assert.match(err.message, /didn't give this app access to any catalog/);
      return true;
    });
  });
}

test("a Graph permission error is an error with Meta's code, never 'no catalogs'", async () => {
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken({})],
    [/assigned_product_catalogs/, () => jsonResponse(400, { error: { code: 100, message: "(#100) Missing Permission" } })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  await assert.rejects(oauth.listGrantedCatalogs(tenantId), (err) => {
    assert.equal(err.metaCode, 100);
    assert.match(err.message, /\(code 100\)/);
    assert.notEqual(err.code, "NO_CATALOG_GRANTED");
    assert.doesNotMatch(err.message, /didn't give this app access/);
    return true;
  });
});

test("complete: only a granted catalog is accepted", async () => {
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/debug_token/, debugToken({ granular_scopes: [{ scope: "catalog_management", target_ids: ["555", "666"] }] })],
    [/\/(555|666)\?/, catalogNode],
    [/\/me\?/, () => jsonResponse(200, { id: "su1", client_business_id: "111" })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  await assert.rejects(oauth.completeConnection({ tenantId, catalogId: "999" }), { code: "CATALOG_NOT_ACCESSIBLE" });
  await oauth.completeConnection({ tenantId, catalogId: "666" });
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean();
  assert.equal(conn.status, "connected");
  assert.equal(conn.catalog_id, "666");
});

test("disconnect revokes the token at Meta and deletes the connection row", async () => {
  const tenantId = fixtureId();
  const seen = stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "sys-user-token" })],
    [/me\/permissions/, () => jsonResponse(200, { success: true })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  assert.equal(await oauth.disconnect(tenantId), true);
  const revoke = seen.find((c) => /me\/permissions/.test(c.url));
  assert.equal(revoke?.opts?.method, "DELETE");
  assert.equal(await ChannelConnection.countDocuments({ tenant_id: tenantId, platform: "meta" }), 0);
  assert.equal(await oauth.disconnect(tenantId), false, "nothing left to disconnect");
});

test("disconnect still deletes the row when Meta refuses the revoke", async () => {
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "sys-user-token" })],
    [/me\/permissions/, () => jsonResponse(400, { error: { code: 200, message: "Permissions error" } })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  assert.equal(await oauth.disconnect(tenantId), true);
  assert.equal(await ChannelConnection.countDocuments({ tenant_id: tenantId, platform: "meta" }), 0);
});

test("tokens, app secret and appsecret_proof never reach the logs", async () => {
  const lines = [];
  for (const level of ["info", "warn", "error", "debug"]) mock.method(logger, level, (...args) => lines.push(JSON.stringify(args)));
  const connected = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "very-secret-token" })],
    [/debug_token/, debugToken({ granular_scopes: [{ scope: "catalog_management", target_ids: ["555"] }] })],
    [/\/555\?/, catalogNode],
    [/\/me\?/, () => jsonResponse(200, { id: "su1", client_business_id: "111" })],
  ]);
  await oauth.savePendingConnection({ tenantId: connected, code: "abc" });
  await oauth.connectSingleGrantedCatalog(connected);
  mock.restoreAll();
  for (const level of ["info", "warn", "error", "debug"]) mock.method(logger, level, (...args) => lines.push(JSON.stringify(args)));

  const failed = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "very-secret-token" })],
    [/debug_token/, () => jsonResponse(400, { error: { code: 190, message: "Invalid OAuth access token" } })],
  ]);
  await oauth.savePendingConnection({ tenantId: failed, code: "abc" });
  await assert.rejects(oauth.listGrantedCatalogs(failed));
  const all = lines.join("\n");
  assert.ok(lines.length > 0, "the flow logged something to check");
  for (const secret of ["very-secret-token", "secret-1", "app-1|secret-1", appSecretProof("very-secret-token")]) assert.ok(!all.includes(secret), secret);
});

test("environment invariants: no module-level token cache in Meta services", () => {
  for (const file of ["meta.oauth.service.js", "meta.graph-api.service.js", "meta.catalog-api.service.js"]) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.doesNotMatch(source, /^\s*let\s+_?\w*[Tt]oken\w*\s*=/m, file);
    assert.doesNotMatch(source, /https:\/\/graph\.facebook\.com/, `${file} must read the host from config`);
  }
});
