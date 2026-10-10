// services/marketplace/async-publish.service.test.js
// Async batch lifecycle: pending, fenced confirm, failures, timeout, restart.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { useMetaTestConfig, makeMetaTenant, makeMetaListing, stubGraph } = require("../../testUtils/metaFixtures");

const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const Inventory = require("../../models/Inventory");
const channelQueue = require("../../queues/channel.queue");
const registry = require("./registry");
const metaAdapter = require("./adapters/meta.adapter");
registry.register(metaAdapter);

const { syncListing, syncBatch } = require("./sync.service");
const asyncPublish = require("./async-publish.service");

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

// Captures enqueues instead of touching Redis.
function captureEnqueues() {
  const jobs = [];
  mock.method(channelQueue, "enqueueChannelJob", async (platform, name, data, opts) => {
    jobs.push({ platform, name, data, opts });
    return { id: `job-${jobs.length}` };
  });
  return jobs;
}

const raw = (id) => MarketplaceListing.collection.findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
const checkJobs = (jobs) => jobs.filter((j) => j.name === "check_batch_status");

function finished(errors = [], extra = {}) {
  return [200, { data: [{ status: "finished", errors_total_count: errors.length, errors, ids_of_invalid_requests: [], ...extra }] }];
}

test("syncListing on an async adapter: pending, seq not stamped, check job carries the mapping", async () => {
  const tenant = await makeMetaTenant();
  const { listing, sku } = await makeMetaListing(tenant, { listing: { push_seq: 3 } });
  const calls = stubGraph();
  const jobs = captureEnqueues();

  const result = await syncListing(String(listing._id), 3);
  assert.equal(result.pending, true);
  assert.equal(calls.itemsBatch.length, 1);

  const doc = await raw(listing._id);
  assert.equal(doc.sync_status, "pending");
  assert.equal(doc.last_pushed_seq, 0, "last_pushed_seq must not be stamped at send time");
  assert.equal(doc.synced_at, null, "synced_at must not be stamped at send time");
  assert.equal(doc.inflight_seq, 3);
  assert.equal(doc.external_listing_id, `meta:222:${sku}`);

  const [job] = checkJobs(jobs);
  assert.ok(job, "a check_batch_status job is enqueued");
  assert.equal(job.platform, "meta");
  assert.equal(job.data.handle, "h-1");
  assert.equal(job.data.tenantId, String(tenant.tenantId));
  assert.deepEqual(job.data.items, [{ listingId: String(listing._id), retailerId: sku, sentSeq: 3, quantity: 4 }]);
  assert.ok(job.opts.delay > 0);
  assert.equal(job.opts.jobId, undefined, "must not inherit the sync_listing debounce jobId");
});

test("status check confirms success: listing synced and last_pushed_seq stamped", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant, { listing: { push_seq: 2 } });
  stubGraph({ checkStatus: () => finished() });
  const jobs = captureEnqueues();
  await syncListing(String(listing._id), 2);

  const outcome = await asyncPublish.processCheckBatchStatus(checkJobs(jobs)[0].data);
  assert.deepEqual(outcome, { done: true, succeeded: 1, failed: 0 });
  const doc = await raw(listing._id);
  assert.equal(doc.sync_status, "synced");
  assert.equal(doc.last_pushed_seq, 2);
  assert.ok(doc.synced_at instanceof Date);
  assert.equal(doc.synced_quantity, 4);
  assert.equal(doc.inflight_seq, undefined, "in-flight marker released");
});

test("partial failure in a batch: only the failed listing errors, with a log row", async () => {
  const tenant = await makeMetaTenant();
  const good = await makeMetaListing(tenant);
  const bad = await makeMetaListing(tenant);
  const viaIds = await makeMetaListing(tenant);
  stubGraph({
    checkStatus: () => finished([{ line: 2, id: bad.sku, message: "Price is invalid" }], { errors_total_count: 2, ids_of_invalid_requests: [viaIds.sku] }),
  });
  const jobs = captureEnqueues();

  const summary = await syncBatch("meta", tenant.tenantId);
  assert.equal(summary.pending, 3);
  const pendingJobs = checkJobs(jobs);
  assert.equal(pendingJobs.length, 1, "one check job per batch handle");

  const outcome = await asyncPublish.processCheckBatchStatus(pendingJobs[0].data);
  assert.deepEqual(outcome, { done: true, succeeded: 1, failed: 2 });
  assert.equal((await raw(good.listing._id)).sync_status, "synced");
  const badDoc = await raw(bad.listing._id);
  assert.equal(badDoc.sync_status, "error");
  assert.equal(badDoc.sync_error, "Price is invalid");
  assert.equal(badDoc.last_pushed_seq, 0);
  assert.equal((await raw(viaIds.listing._id)).sync_status, "error");
  const rows = await ChannelSyncLog.find({ tenant_id: tenant.tenantId, status: "failure" }).lean();
  assert.deepEqual(rows.map((r) => String(r.entity_id)).sort(), [String(bad.listing._id), String(viaIds.listing._id)].sort());
});

test("unattributed errors fail every unnamed item rather than marking it synced", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  stubGraph({ checkStatus: () => finished([], { errors_total_count: 1 }) });
  const jobs = captureEnqueues();
  await syncListing(String(listing._id), 1);
  await asyncPublish.processCheckBatchStatus(checkJobs(jobs)[0].data);
  const doc = await raw(listing._id);
  assert.equal(doc.sync_status, "error");
  assert.match(doc.sync_error, /without naming the items/);
});

test("a stale confirmation never overwrites a newer one", async () => {
  const tenant = await makeMetaTenant();
  const syncedAt = new Date("2026-01-01T00:00:00Z");
  const { listing, sku } = await makeMetaListing(tenant, {
    listing: { push_seq: 5, last_pushed_seq: 5, synced_at: syncedAt, sync_status: "synced", synced_quantity: 9 },
  });
  stubGraph({ checkStatus: () => finished() });
  captureEnqueues();

  const data = { platform: "meta", tenantId: String(tenant.tenantId), handle: "old", kind: "push", attempt: 0,
    items: [{ listingId: String(listing._id), retailerId: sku, sentSeq: 3, quantity: 1 }] };
  await asyncPublish.processCheckBatchStatus(data);
  const doc = await raw(listing._id);
  assert.equal(doc.last_pushed_seq, 5);
  assert.equal(doc.synced_quantity, 9);
  assert.equal(doc.sync_status, "synced");
  assert.deepEqual(doc.synced_at, syncedAt);
});

test("a batch that never finishes errors its listings after the bounded checks", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  const calls = stubGraph({ checkStatus: () => [200, { data: [{ status: "in_progress" }] }] });
  const jobs = captureEnqueues();
  await syncListing(String(listing._id), 1);

  let data = checkJobs(jobs)[0].data;
  let outcome;
  for (let i = 0; i < config.channels.batchStatusMaxAttempts; i++) {
    outcome = await asyncPublish.processCheckBatchStatus(data);
    if (outcome.timedOut) break;
    assert.equal(outcome.pending, true);
    data = checkJobs(jobs).at(-1).data;
    assert.equal(data.attempt, i + 1, "attempt counter travels in the job data");
  }
  assert.equal(outcome.timedOut, true);
  assert.equal(calls.checkStatus.length, config.channels.batchStatusMaxAttempts);
  assert.equal(checkJobs(jobs).length, config.channels.batchStatusMaxAttempts, "no check scheduled after giving up");
  const doc = await raw(listing._id);
  assert.equal(doc.sync_status, "error");
  assert.match(doc.sync_error, /did not confirm batch .* after \d+ status checks/);
  assert.equal(doc.inflight_seq, undefined);
  const row = await ChannelSyncLog.findOne({ entity_id: listing._id, status: "failure" }).lean();
  assert.equal(row.error_code, "batch_status_timeout");
});

test("a throttled status check retries and counts toward the breaker", async () => {
  const tenant = await makeMetaTenant();
  const { listing } = await makeMetaListing(tenant);
  stubGraph({ checkStatus: () => [400, { error: { message: "Too many calls", code: 80009 } }] });
  const jobs = captureEnqueues();
  await syncListing(String(listing._id), 1);
  const outcome = await asyncPublish.processCheckBatchStatus(checkJobs(jobs)[0].data);
  assert.equal(outcome.pending, true);
  assert.equal((await raw(listing._id)).sync_status, "pending");
  const conn = await mongoose.connection.collection("channelconnections").findOne({ tenant_id: tenant.tenantId, platform: "meta" });
  assert.equal(conn.consecutive_failures, 1);
});

test("a stock change during an in-flight batch is pushed after it", async () => {
  const tenant = await makeMetaTenant();
  const { listing, product } = await makeMetaListing(tenant, { stock: 4, listing: { push_seq: 1 } });
  const calls = stubGraph({ checkStatus: () => finished() });
  const jobs = captureEnqueues();
  await syncListing(String(listing._id), 1);
  const firstCheck = checkJobs(jobs)[0].data;

  // Fan-out mid-flight: stock changes and push_seq bumps.
  await Inventory.updateOne({ product: product._id }, { $set: { stock_count: 7 } });
  await MarketplaceListing.updateOne({ _id: listing._id }, { $inc: { push_seq: 1 } });
  const deferred = await syncListing(String(listing._id), 2);
  assert.deepEqual(deferred, { skipped: true, reason: "batch_in_flight" });
  assert.equal(calls.itemsBatch.length, 1, "no overlapping batch for the same listing");

  await asyncPublish.processCheckBatchStatus(firstCheck);
  const repush = jobs.find((j) => j.name === "sync_listing");
  assert.deepEqual(repush.data, { listingId: String(listing._id), seq: 2 });
  assert.equal((await raw(listing._id)).last_pushed_seq, 1);

  await syncListing(repush.data.listingId, repush.data.seq);
  assert.equal(calls.itemsBatch.length, 2);
  assert.equal(calls.itemsBatch[1].requests[0].data.quantity_to_sell_on_facebook, 7);
  await asyncPublish.processCheckBatchStatus(checkJobs(jobs).at(-1).data);
  const doc = await raw(listing._id);
  assert.equal(doc.last_pushed_seq, 2);
  assert.equal(doc.synced_quantity, 7);
});

test("an abandoned in-flight marker doesn't block syncing forever", async () => {
  const tenant = await makeMetaTenant();
  const stale = new Date(Date.now() - asyncPublish.inflightWindowMs() - 1000);
  const { listing } = await makeMetaListing(tenant, { listing: { inflight_seq: 1, inflight_at: stale } });
  const calls = stubGraph();
  captureEnqueues();
  const result = await syncListing(String(listing._id), 1);
  assert.equal(result.pending, true);
  assert.equal(calls.itemsBatch.length, 1);
});

test("a worker restart mid-batch still resolves it from the job data", async (t) => {
  const savedPoll = config.channels.batchStatusPollMs;
  config.channels.batchStatusPollMs = 300;
  const key = `test-meta-restart-${crypto.randomUUID()}`;
  registry.register({ ...metaAdapter, key });
  const { attachCheckBatchStatusProcessor } = require("../../workers/channel.worker");

  const tenant = await makeMetaTenant();
  const { listing, sku } = await makeMetaListing(tenant, { listing: { push_seq: 1, inflight_seq: 1, inflight_at: new Date(), sync_status: "pending" } });
  stubGraph({ checkStatus: () => finished() });
  const data = { platform: key, tenantId: String(tenant.tenantId), handle: "h-restart", kind: "push", attempt: 0,
    items: [{ listingId: String(listing._id), retailerId: sku, sentSeq: 1, quantity: 4 }] };

  // First "worker" enqueues and dies before the delayed check fires.
  const firstQueue = channelQueue.getQueue(key);
  await channelQueue.enqueueChannelJob(key, "check_batch_status", data, { delay: 300 });
  await firstQueue.close();
  channelQueue.queues.delete(key);

  // A fresh process: new queue object, no in-memory state but the job.
  const queue = channelQueue.getQueue(key);
  t.after(async () => {
    config.channels.batchStatusPollMs = savedPoll;
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close();
    channelQueue.queues.delete(key);
  });
  const completed = new Promise((resolve) => queue.on("completed", (_job, result) => resolve(result)));
  attachCheckBatchStatusProcessor({ ...metaAdapter, key }, queue);

  assert.deepEqual(await completed, { done: true, succeeded: 1, failed: 0 });
  const doc = await raw(listing._id);
  assert.equal(doc.sync_status, "synced");
  assert.equal(doc.last_pushed_seq, 1);
});

test("isolation: a synchronous adapter's pending-looking result is not treated as async", async () => {
  const key = "ebay";
  const tenant = await makeMetaTenant();
  const { product } = await makeMetaListing(tenant);
  const listing = await MarketplaceListing.create({
    tenant_id: tenant.tenantId, product: product._id, platform: key, state: "active",
    external_listing_id: `L-${crypto.randomUUID()}`, external_offer_id: `O-${crypto.randomUUID()}`, condition: "NEW", push_seq: 1,
  });
  const previous = registry.has(key) ? registry.get(key) : null;
  registry.register({ key, manifest: { name: "eBay" }, capabilities: {}, update: async () => ({ pending: true, handle: "x", quantity: 2 }) });
  const jobs = captureEnqueues();
  try {
    const result = await syncListing(String(listing._id), 1);
    assert.equal(result.ok, true);
    assert.equal(checkJobs(jobs).length, 0);
    const doc = await raw(listing._id);
    assert.equal(doc.sync_status, "synced");
    assert.equal("inflight_seq" in doc, false, "sync adapters never get in-flight fields");
    assert.equal("inflight_at" in doc, false);
  } finally {
    if (previous) registry.register(previous);
    await MarketplaceListing.deleteOne({ _id: listing._id });
  }
});
