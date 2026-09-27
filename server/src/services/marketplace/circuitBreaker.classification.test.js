// services/marketplace/circuitBreaker.classification.test.js
// Breaker classification on real fetch and resolver errors. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelConnection = require("../../models/ChannelConnection");
const circuitBreaker = require("./circuitBreaker");
const { registerAdapters } = require("./registerAdapters");
const { resolveProductUrl } = require("./listing.resolver");
const { httpError } = require("../../utils/http/httpError");

registerAdapters();

// Recorded 29 times on the real tenant; that Error had no status or code.
const RECORDED_DOMAIN_MESSAGE =
  "No verified default domain for tenant 6a8d5f999ed1e519ab37ad2f — Google Shopping requires a real, " +
  "claimed-and-verified storefront domain and cannot fall back to a shared autopartspro.au subdomain " +
  "(that's this platform's own domain, not one the tenant can verify ownership of with Google Shopping). " +
  "Connect and verify a domain under Settings > Domains before connecting Google Shopping.";

const servers = [];
function listen(onConnection) {
  const server = net.createServer(onConnection);
  servers.push(server);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

async function fetchError(url, opts) {
  try {
    await fetch(url, opts);
  } catch (err) {
    return err;
  }
  throw new Error(`expected fetch(${url}) to fail`);
}

before(() => mongoose.connect(config.mongoUri));
after(async () => {
  servers.forEach((s) => s.close());
  await mongoose.disconnect();
});

// Counts via the real recordFailure write, read back from a fixture connection.
async function failuresAfter(err) {
  const tenantId = fixtureId();
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "google", status: "connected", consecutive_failures: 0, deleted_at: null,
  });
  const result = await circuitBreaker.recordFailure(tenantId, "google", err);
  const conn = await ChannelConnection.collection.findOne({ tenant_id: tenantId });
  return { counted: result.counted, consecutive: conn.consecutive_failures };
}

test("a status-less application error does not count (the changed default)", async () => {
  assert.deepEqual(await failuresAfter(new Error("resolved.stock missing")), { counted: false, consecutive: 0 });
});

test("the domain error, as recorded on the real tenant (message only), does not count", async () => {
  assert.deepEqual(await failuresAfter(new Error(RECORDED_DOMAIN_MESSAGE)), { counted: false, consecutive: 0 });
});

test("the domain error as the resolver throws it now is a tagged 422 and does not count", async () => {
  const err = await resolveProductUrl(fixtureId(), "some-slug", "SKU-1", "google").then(
    () => assert.fail("expected the storefront error"),
    (e) => e,
  );
  assert.match(err.message, /^No verified default domain for tenant /);
  assert.equal(err.status, 422);
  assert.equal(err.code, "CHANNEL_PREREQUISITE_UNMET");
  assert.equal(err.statusReason, "storefront_required");
  assert.deepEqual(await failuresAfter(err), { counted: false, consecutive: 0 });
});

test("ECONNRESET from a real fetch counts", async () => {
  const port = await listen((socket) => socket.on("data", () => socket.resetAndDestroy()));
  const err = await fetchError(`http://127.0.0.1:${port}/`);
  assert.equal(err.message, "fetch failed", "Node 22 wraps network errors; the code is on err.cause");
  assert.equal(err.cause?.code, "ECONNRESET");
  assert.deepEqual(await failuresAfter(err), { counted: true, consecutive: 1 });
});

test("ECONNREFUSED from a real fetch counts", async () => {
  const port = await listen(() => {});
  servers.pop().close();
  await new Promise((r) => setTimeout(r, 20));
  const err = await fetchError(`http://127.0.0.1:${port}/`);
  assert.equal(err.cause?.code, "ECONNREFUSED");
  assert.equal(circuitBreaker.isTransportOrAuthFailure(err), true);
});

test("undici socket close and fetch timeouts count", async () => {
  const closePort = await listen((socket) => socket.on("data", () => socket.end()));
  const closed = await fetchError(`http://127.0.0.1:${closePort}/`);
  assert.equal(closed.cause?.code, "UND_ERR_SOCKET");
  assert.equal(circuitBreaker.isTransportOrAuthFailure(closed), true);

  const hangPort = await listen(() => {});
  const timedOut = await fetchError(`http://127.0.0.1:${hangPort}/`, { signal: AbortSignal.timeout(100) });
  assert.equal(timedOut.name, "TimeoutError");
  assert.equal(circuitBreaker.isTransportOrAuthFailure(timedOut), true);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  const aborted = await fetchError(`http://127.0.0.1:${hangPort}/`, { signal: controller.signal });
  assert.equal(aborted.name, "AbortError");
  assert.equal(circuitBreaker.isTransportOrAuthFailure(aborted), true);
});

test("an AggregateError of refused addresses (happy eyeballs) counts", () => {
  const cause = Object.assign(new AggregateError([
    Object.assign(new Error("connect ECONNREFUSED ::1:80"), { code: "ECONNREFUSED" }),
    Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:80"), { code: "ECONNREFUSED" }),
  ]), { code: "ECONNREFUSED" });
  assert.equal(circuitBreaker.isTransportOrAuthFailure(new TypeError("fetch failed", { cause })), true);
});

test("HTTP status: 503 and 401 count, 403 counts, 400 and 404 do not", async () => {
  assert.deepEqual(await failuresAfter(httpError("Google Merchant API insert failed: 503", 503)), { counted: true, consecutive: 1 });
  assert.deepEqual(await failuresAfter(httpError("Google token refresh failed: 401", 401)), { counted: true, consecutive: 1 });
  assert.equal(circuitBreaker.isTransportOrAuthFailure(httpError("forbidden", 403)), true);
  assert.deepEqual(await failuresAfter(httpError("Missing required field: GTIN", 400)), { counted: false, consecutive: 0 });
  assert.equal(circuitBreaker.isTransportOrAuthFailure(httpError("not found", 404)), false);
});

test("our own Mongo failing never trips a channel breaker", () => {
  const err = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:27017"), {
    name: "MongoNetworkError",
    cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
  });
  assert.equal(circuitBreaker.isTransportOrAuthFailure(err), false);
});
