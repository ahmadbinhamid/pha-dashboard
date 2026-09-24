// services/marketplace/refresh.service.test.js
// Stale-listing refresh sweep; fake adapters, mocked enqueue. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelConnection = require("../../models/ChannelConnection");
const { LISTING_STATE } = require("../../constants/marketplace.constants");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const registry = require("./registry");
const channelQueue = require("../../queues/channel.queue");
const { sweepStaleListings } = require("./refresh.service");

function registerFakeAdapter(platformKey, refreshIntervalDays) {
  registry.register({
    key: platformKey,
    refreshIntervalDays,
    // null when not connected; DISCONNECTED also counts, to test that skip rule.
    async loadSettings(tenantId) {
      const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: platformKey }).lean();
      if (!conn || conn.status === CHANNEL_CONNECTION_STATUS.DISCONNECTED) return null;
      return conn;
    },
  });
}

async function makeTenantConnection(platformKey, status = CHANNEL_CONNECTION_STATUS.CONNECTED) {
  const tenantId = fixtureId();
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId,
    platform: platformKey,
    status,
    consecutive_failures: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return tenantId;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// insertMany: create() throws for unregistered discriminator keys like these.
async function makeListing(tenantId, platformKey, { state = LISTING_STATE.ACTIVE, syncedAt } = {}) {
  const _id = fixtureId();
  await MarketplaceListing.insertMany([
    {
      _id,
      tenant_id: tenantId,
      product: fixtureId(),
      variant: null,
      platform: platformKey,
      state,
      synced_at: syncedAt,
    },
  ]);
  return _id;
}

test("refresh.service: a platform whose adapter declares no refreshIntervalDays is skipped entirely — no query, no jobs enqueued", async (t) => {
  const platformKey = `test-refresh-no-cadence-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, null);

  t.mock.method(ChannelConnection, "find", () => {
    throw new Error("must not query ChannelConnection for a platform with no refreshIntervalDays");
  });
  t.mock.method(channelQueue, "enqueueChannelJob", async () => {
    throw new Error("must not enqueue anything for a platform with no refreshIntervalDays");
  });

  const result = await sweepStaleListings(platformKey);
  assert.deepEqual(result, { skipped: true, reason: "not_applicable" });
});

test("refresh.service: the kill switch disables the sweep entirely — no query, no jobs enqueued", async (t) => {
  const platformKey = `test-refresh-kill-switch-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);

  const original = config.channels.refreshSweepEnabled;
  config.channels.refreshSweepEnabled = false;
  t.after(() => {
    config.channels.refreshSweepEnabled = original;
  });

  t.mock.method(ChannelConnection, "find", () => {
    throw new Error("must not query ChannelConnection while the kill switch is off");
  });
  t.mock.method(channelQueue, "enqueueChannelJob", async () => {
    throw new Error("must not enqueue anything while the kill switch is off");
  });

  const result = await sweepStaleListings(platformKey);
  assert.deepEqual(result, { skipped: true, reason: "sweep_disabled" });
});

test("refresh.service: listings older than the threshold are enqueued; listings inside it are not", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const platformKey = `test-refresh-threshold-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  const tenantId = await makeTenantConnection(platformKey);

  const staleId = await makeListing(tenantId, platformKey, { syncedAt: daysAgo(20) });
  const freshId = await makeListing(tenantId, platformKey, { syncedAt: daysAgo(2) });

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 1, "exactly one sync_batch job must be enqueued");
  const [platform, jobName, payload] = calls[0];
  assert.equal(platform, platformKey);
  assert.equal(jobName, "sync_batch");
  assert.equal(String(payload.tenantId), String(tenantId));
  const idsAsStrings = payload.listingIds.map(String);
  assert.deepEqual(idsAsStrings, [String(staleId)], "only the stale listing must be enqueued");
  assert.ok(!idsAsStrings.includes(String(freshId)), "a listing synced inside the threshold must never be enqueued");
});

test("refresh.service: a listing with synced_at: null (never published) is NOT enqueued", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const platformKey = `test-refresh-null-synced-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  const tenantId = await makeTenantConnection(platformKey);

  await makeListing(tenantId, platformKey, { syncedAt: null });

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 0, "a never-published listing (synced_at: null) must never be treated as stale");
});

test("refresh.service: a listing in a non-active state is NOT enqueued", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const platformKey = `test-refresh-non-active-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  const tenantId = await makeTenantConnection(platformKey);

  await makeListing(tenantId, platformKey, { state: LISTING_STATE.DRAFT, syncedAt: daysAgo(90) });
  await makeListing(tenantId, platformKey, { state: LISTING_STATE.ENDED, syncedAt: daysAgo(90) });

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 0, "a draft/ended listing must never be swept, no matter how old its synced_at is");
});

test("refresh.service: a tenant with a disconnected connection is skipped", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const platformKey = `test-refresh-disconnected-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  const tenantId = await makeTenantConnection(platformKey, CHANNEL_CONNECTION_STATUS.DISCONNECTED);
  await makeListing(tenantId, platformKey, { syncedAt: daysAgo(90) });

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 0, "a disconnected tenant's stale listings must never be enqueued");
});

test("refresh.service: a tenant with a breaker-gated (circuit open) connection is skipped", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const platformKey = `test-refresh-breaker-gated-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  // DEGRADED trips the real circuitBreaker.isOpen; loadSettings still passes.
  const tenantId = await makeTenantConnection(platformKey, CHANNEL_CONNECTION_STATUS.DEGRADED);
  await makeListing(tenantId, platformKey, { syncedAt: daysAgo(90) });

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 0, "a breaker-gated tenant's stale listings must never be enqueued");
});

test("refresh.service: chunking — 1,200 stale listings at chunk size 500 produces 3 batch jobs", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalChunkSize = config.channels.batchChunkSize;
  config.channels.batchChunkSize = 500;
  t.after(() => {
    config.channels.batchChunkSize = originalChunkSize;
  });

  const platformKey = `test-refresh-chunking-${crypto.randomUUID()}`;
  registerFakeAdapter(platformKey, 10);
  const tenantId = await makeTenantConnection(platformKey);

  const docs = Array.from({ length: 1200 }, () => ({
    tenant_id: tenantId,
    product: fixtureId(),
    variant: null,
    platform: platformKey,
    state: LISTING_STATE.ACTIVE,
    synced_at: daysAgo(90),
    sync_status: "synced",
    push_seq: 0,
    last_pushed_seq: 0,
  }));
  await MarketplaceListing.insertMany(docs);

  const calls = [];
  t.mock.method(channelQueue, "enqueueChannelJob", async (...args) => {
    calls.push(args);
    return { id: "fake" };
  });

  await sweepStaleListings(platformKey);

  assert.equal(calls.length, 3, "1200 stale listings at a chunk size of 500 must produce exactly 3 sync_batch jobs");
  const chunkSizes = calls.map(([, , payload]) => payload.listingIds.length).sort((a, b) => b - a);
  assert.deepEqual(chunkSizes, [500, 500, 200]);

  const allIds = new Set(calls.flatMap(([, , payload]) => payload.listingIds.map(String)));
  assert.equal(allIds.size, 1200, "every stale listing must be enqueued exactly once, across all chunks");
});

test("refresh.service: refresh_stale (and the sync_batch jobs it enqueues) never collapse into the sync_listing debounce jobId", async (t) => {
  const platform = `test-refresh-debounce-${crypto.randomUUID()}`;
  const queue = channelQueue.getQueue(platform);
  t.after(() => queue.close());

  // Only "sync_listing" is debounced, so other job names must get distinct ids.
  const refreshJobA = await channelQueue.enqueueChannelJobDirect(platform, "refresh_stale", {}, { delay: 0 });
  const refreshJobB = await channelQueue.enqueueChannelJobDirect(platform, "refresh_stale", {}, { delay: 0 });
  assert.notEqual(refreshJobA.id, refreshJobB.id, "two refresh_stale enqueues must never collapse into the same jobId");

  const batchJobA = await channelQueue.enqueueChannelJobDirect(platform, "sync_batch", { tenantId: "t1", listingIds: ["a"] }, { delay: 0 });
  const batchJobB = await channelQueue.enqueueChannelJobDirect(platform, "sync_batch", { tenantId: "t1", listingIds: ["a"] }, { delay: 0 });
  assert.notEqual(batchJobA.id, batchJobB.id, "two sync_batch enqueues (even with identical payloads) must never collapse into the same jobId");
});
