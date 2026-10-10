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

test("complete: only a catalog the token reaches is accepted, then CONNECTED", async () => {
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "t" })],
    [/\/me\?/, () => jsonResponse(200, { id: "su1", client_business_id: "111" })],
    [/\/111\?/, () => jsonResponse(200, { id: "111", name: "Parts Co" })],
    [/owned_product_catalogs/, () => jsonResponse(200, { data: [{ id: "222", name: "Main" }] })],
    [/client_product_catalogs/, () => jsonResponse(200, { data: [] })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  const businesses = await oauth.listBusinessCatalogs(tenantId);
  assert.deepEqual(businesses, [{ id: "111", name: "Parts Co", catalogs: [{ id: "222", name: "Main" }] }]);

  await assert.rejects(oauth.completeConnection({ tenantId, businessId: "111", catalogId: "999" }), { code: "CATALOG_NOT_ACCESSIBLE" });
  await oauth.completeConnection({ tenantId, businessId: "111", catalogId: "222" });
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: "meta" }).lean();
  assert.equal(conn.status, "connected");
  assert.equal(conn.catalog_id, "222");
  assert.equal(conn.business_id, "111");
});

test("tokens, app secret and appsecret_proof never reach the logs", async () => {
  const lines = [];
  for (const level of ["info", "warn", "error", "debug"]) mock.method(logger, level, (...args) => lines.push(JSON.stringify(args)));
  const tenantId = fixtureId();
  stubFetch([
    [/oauth\/access_token/, () => jsonResponse(200, { access_token: "very-secret-token" })],
    [/\/me\?/, () => jsonResponse(400, { error: { code: 190, message: "Invalid token" } })],
  ]);
  await oauth.savePendingConnection({ tenantId, code: "abc" });
  await assert.rejects(oauth.listBusinessCatalogs(tenantId));
  const all = lines.join("\n");
  for (const secret of ["very-secret-token", "secret-1", appSecretProof("very-secret-token")]) assert.ok(!all.includes(secret), secret);
});

test("environment invariants: no module-level token cache in Meta services", () => {
  for (const file of ["meta.oauth.service.js", "meta.graph-api.service.js", "meta.catalog-api.service.js"]) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.doesNotMatch(source, /^\s*let\s+_?\w*[Tt]oken\w*\s*=/m, file);
    assert.doesNotMatch(source, /https:\/\/graph\.facebook\.com/, `${file} must read the host from config`);
  }
});
