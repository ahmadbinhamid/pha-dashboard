// services/dashboard.service.syncStability.test.js
// Sync stability counts only settled listings: successes vs failures.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const MarketplaceListing = require("../models/MarketplaceListing");
const { registerAdapters } = require("./marketplace/registerAdapters");
const dashboardService = require("./dashboard.service");

registerAdapters();

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

// statuses: { sync_status: count }, all active unless state is given.
async function seedListings(tenantId, platform, statuses, state = "active") {
  const docs = Object.entries(statuses).flatMap(([sync_status, n]) =>
    Array.from({ length: n }, () => ({ tenant_id: tenantId, product: fixtureId(), platform, state, sync_status })),
  );
  await MarketplaceListing.insertMany(docs);
}

function channel(health, key) {
  return health.channels.find((c) => c.key === key);
}

test("stability ignores unsettled listings and counts out_of_stock as success", async () => {
  const tenantId = fixtureId();
  await seedListings(tenantId, "ebay", { synced: 3, out_of_stock: 1, error: 1, pending: 2, not_listed: 1 });
  await seedListings(tenantId, "ebay", { error: 4 }, "ended");
  await seedListings(tenantId, "google", { synced: 1 });

  const health = await dashboardService.getChannelHealth(tenantId);

  const ebay = channel(health, "ebay");
  assert.equal(ebay.listingsTotal, 8, "only active listings count toward the total");
  assert.equal(ebay.listingsSynced, 4, "synced + out_of_stock");
  assert.equal(ebay.listingsFailed, 1);
  assert.equal(ebay.status, "attention");
  assert.equal(channel(health, "google").status, "operational");
  // 5 successes, 1 failure; pending/not_listed/ended don't count either way.
  assert.equal(health.stabilityPct, 83);
});

test("price_locked counts as a failure, matching the Channel sync page", async () => {
  const tenantId = fixtureId();
  await seedListings(tenantId, "ebay", { synced: 1, price_locked: 1 });

  const health = await dashboardService.getChannelHealth(tenantId);
  assert.equal(channel(health, "ebay").listingsFailed, 1);
  assert.equal(channel(health, "ebay").status, "attention");
  assert.equal(health.stabilityPct, 50);
});

test("no failures reads 100% however many listings are unsettled", async () => {
  const tenantId = fixtureId();
  await seedListings(tenantId, "ebay", { synced: 1202, out_of_stock: 40, pending: 5 });

  const health = await dashboardService.getChannelHealth(tenantId);
  assert.equal(health.stabilityPct, 100);
});

test("any failure keeps it under 100% (floored, never rounded up)", async () => {
  const tenantId = fixtureId();
  await seedListings(tenantId, "ebay", { synced: 1202, error: 5 });

  const health = await dashboardService.getChannelHealth(tenantId);
  assert.equal(health.stabilityPct, 99, "1202/1207 is 99.59%, which must not show as 100%");
});

test("nothing settled yet gives null (shown as a dash), not a made-up 100%", async () => {
  const tenantId = fixtureId();
  await seedListings(tenantId, "ebay", { pending: 3, not_listed: 2 });

  const health = await dashboardService.getChannelHealth(tenantId);
  assert.equal(health.stabilityPct, null);
  assert.equal(channel(health, "ebay").status, "operational");

  const empty = await dashboardService.getChannelHealth(fixtureId());
  assert.equal(empty.stabilityPct, null);
  assert.equal(channel(empty, "ebay").status, "not_connected");
});
