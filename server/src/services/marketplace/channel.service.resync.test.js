// services/marketplace/channel.service.resync.test.js
// Re-sync all: one job per active listing, or one batch job for feeds.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const MarketplaceListing = require("../../models/MarketplaceListing");
const registry = require("./registry");
const circuitBreaker = require("./circuitBreaker");
const channelQueue = require("../../queues/channel.queue");

// Mocked before the service loads, as it destructures enqueueChannelJob.
const jobs = [];
mock.method(channelQueue, "enqueueChannelJob", async (platform, name, payload) => {
  jobs.push({ platform, name, payload });
});
const channelService = require("./channel.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

function fakeAdapter({ connected = true, batch = false } = {}) {
  return { manifest: { name: "eBay" }, capabilities: { batch }, loadSettings: async () => (connected ? {} : null) };
}

async function seedListings(t, tenantId) {
  // Unique per product+variant+platform, so each row gets its own product.
  const rows = ["active", "active", "active", "ended"].map((state) => ({
    tenant_id: tenantId,
    product: fixtureId(),
    variant: null,
    platform: "ebay",
    state,
  }));
  const { insertedIds } = await MarketplaceListing.collection.insertMany(rows);
  t.after(() => MarketplaceListing.collection.deleteMany({ _id: { $in: Object.values(insertedIds) } }));
}

test("per-listing channel: one sync_listing job per active listing only", async (t) => {
  jobs.length = 0;
  const tenantId = fixtureId();
  await seedListings(t, tenantId);
  t.mock.method(registry, "getAdapter", () => fakeAdapter());
  t.mock.method(circuitBreaker, "isOpen", async () => false);

  assert.deepEqual(await channelService.resyncAllListings(tenantId, "ebay"), { listings: 3, jobs: 3 });
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((j) => j.name === "sync_listing" && j.payload.seq === null));
});

test("batch channel: one full sync_batch job for the whole catalogue", async (t) => {
  jobs.length = 0;
  const tenantId = fixtureId();
  await seedListings(t, tenantId);
  t.mock.method(registry, "getAdapter", () => fakeAdapter({ batch: true }));
  t.mock.method(circuitBreaker, "isOpen", async () => false);

  assert.deepEqual(await channelService.resyncAllListings(tenantId, "ebay"), { listings: 3, jobs: 1 });
  assert.deepEqual(jobs.map((j) => j.name), ["sync_batch"]);
});

test("a disconnected or paused channel is refused with a 409", async (t) => {
  jobs.length = 0;
  const getAdapter = t.mock.method(registry, "getAdapter", () => fakeAdapter({ connected: false }));
  const isOpen = t.mock.method(circuitBreaker, "isOpen", async () => false);
  await assert.rejects(channelService.resyncAllListings(fixtureId(), "ebay"), (e) => e.status === 409 && /connected/.test(e.message));

  getAdapter.mock.mockImplementation(() => fakeAdapter());
  isOpen.mock.mockImplementation(async () => true);
  await assert.rejects(channelService.resyncAllListings(fixtureId(), "ebay"), (e) => e.status === 409 && /paused/.test(e.message));
  assert.equal(jobs.length, 0);
});
