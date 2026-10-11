// services/meta/meta.errors.test.js
// Graph error classification: throttle vs item vs token, breaker, reauth.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../config");
const { useMetaTestConfig, makeMetaTenant, makeMetaListing, stubGraph } = require("../../testUtils/metaFixtures");

const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { graphResponseError } = require("../../utils/http/graphError");
const { isTransportOrAuthFailure } = require("../marketplace/circuitBreaker");
const { isPrerequisiteError } = require("../marketplace/channel-prerequisite.service");
const registry = require("../marketplace/registry");
registry.register(require("../marketplace/adapters/meta.adapter"));
const { syncListing } = require("../marketplace/sync.service");
const { listChannelsForTenant } = require("../marketplace/channel.service");

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

const body = (code, extra = {}) => JSON.stringify({ error: { message: `err ${code}`, type: "OAuthException", code, ...extra } });
const connectionOf = (tenantId) => mongoose.connection.collection("channelconnections").findOne({ tenant_id: tenantId, platform: "meta" });

test("classification: throttling codes are transport (breaker counts them)", () => {
  for (const code of [4, 17, 32, 613, 80009, 80014]) {
    const err = graphResponseError("items_batch", 400, body(code));
    assert.equal(err.status, 503, `code ${code}`);
    assert.equal(err.metaCode, code);
    assert.equal(err.code, "META_RATE_LIMITED");
    assert.equal(isTransportOrAuthFailure(err), true, `code ${code} must count`);
  }
});

test("classification: item validation (code 100) is data, never counted", () => {
  const err = graphResponseError("items_batch", 400, body(100));
  assert.equal(err.status, 400);
  assert.equal(isTransportOrAuthFailure(err), false);
});

test("classification: code 190 (any subcode) is tagged for reauth, off the breaker", () => {
  for (const subcode of [undefined, 460, 463]) {
    const err = graphResponseError("items_batch", 400, body(190, subcode ? { error_subcode: subcode } : {}));
    assert.equal(isPrerequisiteError(err), true);
    assert.equal(err.statusReason, "reauthentication_required");
    assert.equal(isTransportOrAuthFailure(err), false);
  }
});

test("classification: 5xx and non-JSON bodies stay transport; permissions are auth", () => {
  assert.equal(isTransportOrAuthFailure(graphResponseError("x", 502, "<html>bad gateway</html>")), true);
  assert.equal(graphResponseError("x", 400, body(200)).status, 403);
  assert.equal(isTransportOrAuthFailure(graphResponseError("x", 400, body(2))), true);
});

test("sync: a throttled items_batch counts toward the breaker and rethrows for retry", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  stubGraph({ itemsBatch: () => [400, JSON.parse(body(80014))] });
  await assert.rejects(syncListing(String(listing._id), 1), /code 80014/);
  assert.equal((await connectionOf(tenant.tenantId)).consecutive_failures, 1);
});

test("sync: a per-item validation error does not count toward the breaker", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  stubGraph({ itemsBatch: (requests) => [200, { handles: [], validation_status: [{ retailer_id: requests[0].data.id, errors: [{ message: "bad price" }] }] }] });
  await assert.rejects(syncListing(String(listing._id), 1), /bad price/);
  assert.equal((await connectionOf(tenant.tenantId)).consecutive_failures, 0);
  const doc = await MarketplaceListing.collection.findOne({ _id: listing._id });
  assert.equal(doc.sync_status, "error");
});

test("sync: code 190 flags reauthentication_required and shows Reconnect Meta", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  const calls = stubGraph({ itemsBatch: () => [400, JSON.parse(body(190, { error_subcode: 463 }))] });
  assert.deepEqual(await syncListing(String(listing._id), 1), { skipped: true, reason: "reauthentication_required" });
  const conn = await connectionOf(tenant.tenantId);
  assert.equal(conn.status, "error");
  assert.equal(conn.status_reason, "reauthentication_required");
  assert.match(conn.last_error, /Reconnect Meta/);
  assert.equal(conn.consecutive_failures, 0);
  assert.equal(await ChannelSyncLog.countDocuments({ tenant_id: tenant.tenantId, status: "failure" }), 0);

  // Sticky: no further calls against a refused token.
  await syncListing(String(listing._id), 1);
  assert.equal(calls.itemsBatch.length, 1);
  const channel = (await listChannelsForTenant(tenant.tenantId)).find((c) => c.key === "meta");
  assert.match(channel.connection.status_message, /Reconnect Meta/);
});

test("an expired dated token flags reauth without calling Meta", async () => {
  const tenant = await makeMetaTenant({ connection: { token_expires_at: new Date(Date.now() - 1000) } });
  const { listing } = await makeMetaListing(tenant);
  const calls = stubGraph();
  assert.deepEqual(await syncListing(String(listing._id), 1), { skipped: true, reason: "reauthentication_required" });
  assert.equal(calls.itemsBatch.length, 0);
});
