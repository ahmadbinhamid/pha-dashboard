// queues/channel.queue.debounce.test.js
// Regression guard: N rapid sync_listing enqueues for the same listing collapse into exactly
// one Bull job, and the { listingId, seq } payload shape still round-trips correctly.
// Needs a live Redis connection. Run: node --test src/queues/channel.queue.debounce.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { enqueueChannelJob, getQueue } = require("./channel.queue");

const queue = getQueue("ebay");

// Bull's ioredis client stays open indefinitely by design; close it or the process never exits.
test.after(async () => {
  await queue.close();
});

test("debounced sync_listing enqueue collapses N rapid calls into one job, carrying the old {listingId, seq} payload shape", async (t) => {
  const listingId = `debounce-test-${crypto.randomUUID()}`;
  const jobId = `sync:ebay:${listingId}`;

  // Guard against a stale job left behind by a previous failed run; keeps this test self-cleaning.
  const preExisting = await queue.getJob(jobId);
  if (preExisting) await preExisting.remove();

  await Promise.all([
    enqueueChannelJob("ebay", "sync_listing", { listingId, seq: 1 }),
    enqueueChannelJob("ebay", "sync_listing", { listingId, seq: 2 }),
    enqueueChannelJob("ebay", "sync_listing", { listingId, seq: 3 }),
    enqueueChannelJob("ebay", "sync_listing", { listingId, seq: 4 }),
    enqueueChannelJob("ebay", "sync_listing", { listingId, seq: 5 }),
  ]);

  const job = await queue.getJob(jobId);
  assert.ok(job, "exactly one job must exist under the debounced jobId");
  assert.equal(job.opts.delay > 0, true, "the debounced job must carry a delay");
  assert.equal(job.opts.removeOnComplete, true, "removeOnComplete must be true — see channel.queue.js's Bull gotcha comment");
  // removeOnFail: true — a failed job left under this jobId would otherwise permanently block
  // every future call for this listing. ChannelSyncLog is the durable failure record now.
  assert.equal(job.opts.removeOnFail, true);

  // Old-shape payload; whichever of the N calls won the dedup, its data is still the same
  // shape a pre-migration job carried — the worker re-reads current state anyway.
  assert.deepEqual(Object.keys(job.data).sort(), ["listingId", "seq"].sort());
  assert.equal(job.data.listingId, listingId);

  await job.remove();
});

test("a listing whose debounced sync_listing job has failed (exhausted its retries) can still be re-enqueued", async (t) => {
  // A dedicated platform/queue so this test can force a real failure without touching "ebay".
  const platform = `test-fail-reenqueue-${crypto.randomUUID()}`;
  const listingId = `fail-reenqueue-${crypto.randomUUID()}`;
  const jobId = `sync:${platform}:${listingId}`;
  const testQueue = getQueue(platform);
  t.after(async () => {
    await testQueue.close();
  });

  let attempts = 0;
  testQueue.process("sync_listing", 1, async () => {
    attempts++;
    if (attempts === 1) throw new Error("simulated failure");
    return { ok: true };
  });

  // attempts:1 so it fails on the first try with no retry wait; delay:10 keeps the test fast.
  await enqueueChannelJob(platform, "sync_listing", { listingId }, { attempts: 1, delay: 10 });
  await new Promise((resolve) => testQueue.once("failed", resolve));
  assert.equal(attempts, 1);

  // The Bull gotcha this fixes: add() returns the existing job for a jobId in any state,
  // including failed — without removeOnFail: true, this call would be silently swallowed forever.
  await enqueueChannelJob(platform, "sync_listing", { listingId }, { delay: 10 });

  const result = await new Promise((resolve) => testQueue.once("completed", (job, r) => resolve(r)));
  assert.equal(attempts, 2, "the re-enqueued job must have actually run a second attempt, not been dropped");
  assert.deepEqual(result, { ok: true });

  // Confirm the jobId itself isn't left stuck for a third call either.
  const afterCompletion = await testQueue.getJob(jobId);
  assert.equal(afterCompletion, null, "removeOnComplete must still clear the slot after a successful re-enqueue");
});
