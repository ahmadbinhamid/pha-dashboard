// services/marketplace/channel.service.test.js
// retryChannelLog enqueues over a failed debounced job. Needs Mongo+Redis.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const { getQueue } = require("../../queues/channel.queue");
const { retryChannelLog } = require("./channel.service");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

test("retryChannelLog enqueues a fresh job even when a failed job for that listing already exists", async (t) => {
  await mongoose.connect(config.mongoUri);

  const platform = `test-retry-${crypto.randomUUID()}`;
  const tenantId = fixtureId();
  const listingId = fixtureId();
  const jobId = `sync:${platform}:${listingId.toString()}`;
  const queue = getQueue(platform);
  t.after(async () => {
    await queue.close();
    await mongoose.disconnect();
  });

  // Park a FAILED job under the debounced jobId (removeOnFail: false keeps it).
  queue.process("sync_listing", 1, async () => {
    throw new Error("boom");
  });
  await queue.add(
    "sync_listing",
    { listingId: listingId.toString() },
    { jobId, attempts: 1, removeOnFail: false },
  );
  await new Promise((resolve) => queue.once("failed", resolve));

  const stuckJob = await queue.getJob(jobId);
  assert.ok(stuckJob, "sanity check: the failed job must still be sitting there under the debounced jobId");
  assert.equal(await stuckJob.getState(), "failed");

  const log = await ChannelSyncLog.create({
    tenant_id: tenantId,
    platform,
    job_type: "update",
    entity_type: "MarketplaceListing",
    entity_id: listingId,
    status: CHANNEL_SYNC_LOG_STATUS.FAILURE,
    error_message: "boom",
  });

  const result = await retryChannelLog(tenantId, platform, log._id);
  assert.equal(result.requeued, true);
  assert.equal(result.listingId, listingId.toString());

  // Retry must create a new runnable job, not be swallowed by the failed jobId.
  const jobCounts = await queue.getJobCounts();
  assert.ok(
    jobCounts.waiting + jobCounts.active + jobCounts.delayed >= 1,
    "retry must enqueue a real, runnable job rather than being dropped",
  );

  // And it must not have touched the debounced jobId at all.
  const stillStuck = await queue.getJob(jobId);
  assert.ok(stillStuck);
  assert.equal(await stillStuck.getState(), "failed");

  await ChannelSyncLog.deleteMany({ tenant_id: tenantId });
});
