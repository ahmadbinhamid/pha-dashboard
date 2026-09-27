// services/marketplace/channel.service.logs.test.js
// getChannelLogs entityId/status filters stay tenant-scoped. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const { getChannelLogs } = require("./channel.service");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const { SUCCESS, FAILURE } = CHANNEL_SYNC_LOG_STATUS;

test("getChannelLogs filters by entity and status, newest first, never across tenants", async () => {
  const [tenantId, otherTenant, listingA, listingB] = [0, 1, 2, 3].map(() => fixtureId());
  const row = (tenant_id, entity_id, status, minutesAgo) => ({
    tenant_id, platform: "google", job_type: "update", entity_type: "MarketplaceListing", entity_id, status,
    error_message: status === FAILURE ? `fail ${minutesAgo}` : null, created_at: new Date(Date.now() - minutesAgo * 60_000),
  });
  await ChannelSyncLog.collection.insertMany([
    row(tenantId, listingA, FAILURE, 30),
    row(tenantId, listingA, SUCCESS, 20),
    row(tenantId, listingA, FAILURE, 10),
    row(tenantId, listingB, FAILURE, 5),
    row(otherTenant, listingA, FAILURE, 1),
  ]);

  const all = await getChannelLogs(tenantId, "google", { entityId: listingA });
  assert.equal(all.total, 3, "only listingA's rows for this tenant");
  assert.deepEqual(all.items.map((l) => l.status), [FAILURE, SUCCESS, FAILURE]);

  const latestFailure = await getChannelLogs(tenantId, "google", { entityId: listingA, status: FAILURE, limit: 1 });
  assert.equal(latestFailure.total, 2);
  assert.equal(latestFailure.items[0].error_message, "fail 10", "newest failure first");

  assert.equal((await getChannelLogs(tenantId, "google")).total, 4, "unfiltered call is unchanged");
});
