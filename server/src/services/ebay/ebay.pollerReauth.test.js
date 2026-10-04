// services/ebay/ebay.pollerReauth.test.js
// eBay pollers flag a refused token, skip it, and resume on reconnect. Mongo.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelConnection = require("../../models/ChannelConnection");
const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const { encrypt, packCiphertext } = require("../../utils/crypto/tokenCipher");
const ebayApi = require("./ebay.api.service");
const ebaySettings = require("./ebay.settings.service");

// Only this file's tenants are polled; the shared DB's real one never is.
let polledTenantIds = [];
const getSettings = ebaySettings.getSettings;
mock.method(ebaySettings, "listConfiguredTenants", async () => Promise.all(polledTenantIds.map((id) => getSettings(id))));

const { pollAndProcessOrders } = require("./ebay.orders.service");
const { reconcileEbayInventory } = require("./ebay.inventory-sync.service");

const REAUTH = "reauthentication_required";
const INVALID_GRANT = { error: "invalid_grant", error_description: "the provided authorization refresh token is invalid" };

// getAccessToken's own credentials check reads these; dev .env sets them.
config.ebay.clientId ||= "test-client-id";
config.ebay.clientSecret ||= "test-client-secret";

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

let fetchMock = null;
afterEach(() => fetchMock?.mock.restore());

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

// Token endpoint answers `token`; eBay API calls answer `api`.
function stubFetch({ token, api = () => jsonResponse(200, { orders: [], total: 0, inventoryItems: [] }) }) {
  const calls = { token: 0, api: 0 };
  fetchMock = mock.method(global, "fetch", async (url) => {
    if (String(url).includes("/identity/v1/oauth2/token")) {
      calls.token++;
      return token();
    }
    calls.api++;
    return api(String(url));
  });
  return calls;
}

const tokenOk = () => jsonResponse(200, { access_token: `access-${crypto.randomUUID()}`, expires_in: 7200 });

async function makeTenant() {
  const tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Poller ${suffix}`, slug: `poller-${suffix}`, code: `PL${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "ebay", status: "connected", consecutive_failures: 0, status_reason: null,
    last_error: null, deleted_at: null, sandbox: true, marketplace_id: "EBAY_AU",
    refresh_token_ct: packCiphertext(encrypt(`refresh-${suffix}`)),
  });
  polledTenantIds = [tenantId];
  return tenantId;
}

const connectionOf = (tenantId) => ChannelConnection.collection.findOne({ tenant_id: tenantId, platform: "ebay" });

test("poll_orders: invalid_grant flags the connection reauthentication_required", async () => {
  const tenantId = await makeTenant();
  const calls = stubFetch({ token: () => jsonResponse(400, INVALID_GRANT) });

  await pollAndProcessOrders();

  assert.equal(calls.token, 1);
  assert.equal(calls.api, 0);
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, REAUTH);
  assert.match(conn.last_error, /Reconnect eBay/, "the tenant-facing remedy, not the raw token error");
});

test("poll_orders: a flagged tenant is skipped without calling the token endpoint", async () => {
  const tenantId = await makeTenant();
  stubFetch({ token: () => jsonResponse(400, INVALID_GRANT) });
  await pollAndProcessOrders();
  fetchMock.mock.restore();

  const calls = stubFetch({ token: () => assert.fail("a flagged tenant must not refresh") });
  const result = await pollAndProcessOrders();

  assert.equal(calls.token, 0);
  assert.equal(calls.api, 0);
  assert.equal(result.tenants, 0);
  assert.equal((await connectionOf(tenantId)).status_reason, REAUTH);
});

test("poll_orders: a reconnect clears the flag and polling resumes", async () => {
  const tenantId = await makeTenant();
  stubFetch({ token: () => jsonResponse(400, INVALID_GRANT) });
  await pollAndProcessOrders();
  fetchMock.mock.restore();

  // The writes oauthCallback makes after the code exchange.
  await ebaySettings.upsertSettings(tenantId, { refresh_token: "fresh-refresh-token" });
  ebayApi.clearTokenCache(tenantId);
  assert.equal((await connectionOf(tenantId)).status_reason, null);

  const calls = stubFetch({ token: tokenOk });
  const result = await pollAndProcessOrders();

  assert.equal(result.tenants, 1);
  assert.equal(calls.token, 1);
  assert.equal(calls.api, 1, "orders were fetched again");
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "connected");
  assert.equal(conn.status_reason, null);
});

test("poll_orders: an unrelated poll error keeps the old path and never flags", async () => {
  const tenantId = await makeTenant();
  stubFetch({ token: tokenOk, api: () => jsonResponse(500, { errors: [{ message: "eBay is down" }] }) });

  await pollAndProcessOrders();

  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, null);
  assert.match(conn.last_error, /getOrders failed: 500/);
});

test("poll_orders: an unrelated 400 from the token endpoint never flags", async () => {
  const tenantId = await makeTenant();
  stubFetch({ token: () => jsonResponse(400, { error: "invalid_scope" }) });

  await pollAndProcessOrders();

  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, null);
  assert.match(conn.last_error, /could not obtain access token/);
});

test("poll_inventory: invalid_grant flags the connection, then the tenant is skipped", async () => {
  const tenantId = await makeTenant();
  // The inventory poller only calls eBay for a tenant with live offers.
  const suffix = crypto.randomUUID();
  const product = await Product.create({ tenant_id: tenantId, title: `Inv ${suffix}`, slug: `inv-${suffix}`, sku: `INV-${suffix}` });
  await MarketplaceListing.create({
    tenant_id: tenantId, product: product._id, platform: "ebay", state: "active", external_offer_id: `O-${suffix}`,
  });
  const calls = stubFetch({ token: () => jsonResponse(400, INVALID_GRANT) });

  await reconcileEbayInventory();
  assert.equal(calls.token, 1);
  const conn = await connectionOf(tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, REAUTH);

  await reconcileEbayInventory();
  assert.equal(calls.token, 1, "no second refresh while flagged");
});
