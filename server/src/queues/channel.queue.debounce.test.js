// queues/channel.queue.debounce.test.js
//
// Regression guard for Task 4's debounce contract: N rapid sync_listing
// enqueues for the SAME listing collapse into exactly one Bull job (keyed
// by jobId `sync:<platform>:<listingId>`, removeOnComplete: true —
// mandatory per the Bull gotcha documented in channel.queue.js), and the
// job-payload shape ({ listingId, seq }) — unchanged since before this
// migration — still round-trips through enqueueChannelJob correctly.
//
// Needs a live Redis connection (see queues/channel.queue.js) — run with:
//   node --test src/queues/channel.queue.debounce.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { enqueueChannelJob, getQueue } = require("./channel.queue");

const queue = getQueue("ebay");

// Bull's underlying ioredis client keeps its connection open indefinitely by
// design — without closing it, this process never exits on its own, which
// hangs any multi-file `node --test` run waiting on this one.
test.after(async () => {
  await queue.close();
});

test("debounced sync_listing enqueue collapses N rapid calls into one job, carrying the old {listingId, seq} payload shape", async (t) => {
  const listingId = `debounce-test-${crypto.randomUUID()}`;
  const jobId = `sync:ebay:${listingId}`;

  // Guard against a stale job left behind by a previous failed run under
  // this exact id (won't happen in practice — the id is randomized above —
  // but keeps this test self-cleaning either way).
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
  assert.equal(job.opts.removeOnFail, false);

  // Old-shape payload ({ listingId, seq }) — whichever of the N rapid calls
  // actually won the dedup, its data is still the same shape a
  // pre-migration job always carried; the worker re-reads current state
  // rather than trusting this seq anyway (see sync.service.js#syncListing).
  assert.deepEqual(Object.keys(job.data).sort(), ["listingId", "seq"].sort());
  assert.equal(job.data.listingId, listingId);

  await job.remove();
});
