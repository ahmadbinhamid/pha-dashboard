// services/marketplace/async-publish.service.js
// Tracks async-channel batches: pending state, status polling, fenced stamps.

const { logger } = require("../../loaders/logging");
const MarketplaceListing = require("../../models/MarketplaceListing");
const config = require("../../config");
const channelQueue = require("../../queues/channel.queue");
const { getAdapter } = require("./registry");
const circuitBreaker = require("./circuitBreaker");
const { flagIfPrerequisiteError } = require("./channel-prerequisite.service");
const { logSyncEvents } = require("./sync-log.service");
const { LISTING_STATE, LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");
const { CHANNEL_SYNC_LOG_STATUS, CHANNEL_JOB, ASYNC_BATCH_KIND } = require("../../constants/channel.constants");

function isAsyncAdapter(adapter) {
  return adapter?.capabilities?.asyncPublish === true;
}

// Delay before check `attempt` (0-based): poll interval doubled per attempt.
function checkDelayMs(attempt) {
  return config.channels.batchStatusPollMs * 2 ** attempt;
}

// Longest a batch can stay unconfirmed before its listings are errored.
function inflightWindowMs() {
  let total = 0;
  for (let i = 0; i < config.channels.batchStatusMaxAttempts; i++) total += checkDelayMs(i);
  return total * 2;
}

/** True while a listing's last batch is unconfirmed and not yet abandoned. */
function hasLiveInflightBatch(listing, now = Date.now()) {
  if (listing?.inflight_seq == null || !listing.inflight_at) return false;
  return now - new Date(listing.inflight_at).getTime() < inflightWindowMs();
}

function fencedFilter(listingId, sentSeq) {
  return { _id: listingId, $or: [{ last_pushed_seq: { $lte: sentSeq } }, { last_pushed_seq: null }] };
}

// Releases the in-flight marker only if it still belongs to this batch.
function releaseOp(item, extraFilter = {}, $set = null) {
  return {
    updateOne: {
      filter: { _id: item.listingId, inflight_seq: item.sentSeq, ...extraFilter },
      update: { ...($set ? { $set } : {}), $unset: { inflight_seq: 1, inflight_at: 1 } },
    },
  };
}

function logRow(data, item, status, extra = {}) {
  const jobType = data.kind === ASYNC_BATCH_KIND.END ? "end" : CHANNEL_JOB.CHECK_BATCH_STATUS;
  return { tenantId: data.tenantId, platform: data.platform, jobType, entityId: item.listingId, status, ...extra };
}

/** Logs and errors failed items; [{ item, message, errorCode? }], batched. */
async function failItems(data, failures) {
  if (!failures.length) return;
  await logSyncEvents(failures.map(({ item, message, errorCode }) =>
    logRow(data, item, CHANNEL_SYNC_LOG_STATUS.FAILURE, { errorCode: errorCode ?? null, errorMessage: message })));
  if (data.kind === ASYNC_BATCH_KIND.END) return;
  // Only the batch that still owns a listing may mark it errored.
  await MarketplaceListing.bulkWrite(
    failures.map(({ item, message }) => releaseOp(item, {}, { sync_status: LISTING_SYNC_STATUS.ERROR, sync_error: message })),
    { ordered: false, strict: false },
  );
}

// Fenced stamp per item; status only where this batch is now the latest push.
function confirmOps(item, now) {
  const status = item.quantity === 0 ? LISTING_SYNC_STATUS.OUT_OF_STOCK : LISTING_SYNC_STATUS.SYNCED;
  return [
    {
      updateOne: {
        filter: fencedFilter(item.listingId, item.sentSeq),
        update: {
          $set: { synced_at: now, sync_error: null, state: LISTING_STATE.ACTIVE, ...(item.quantity != null ? { synced_quantity: item.quantity } : {}) },
          $max: { last_pushed_seq: item.sentSeq },
        },
      },
    },
    releaseOp(item, { last_pushed_seq: item.sentSeq }, { sync_status: status }),
    // Stale confirm: the stamp didn't apply, so just drop the marker.
    releaseOp(item),
  ];
}

/** Confirms items in one ordered bulkWrite; a stale confirm never wins. */
async function confirmItems(data, items) {
  if (!items.length) return;
  const current = await MarketplaceListing.find({ _id: { $in: items.map((i) => i.listingId) } }).select("last_pushed_seq").lean();
  const lastPushed = new Map(current.map((d) => [String(d._id), d.last_pushed_seq ?? 0]));
  const now = new Date();
  // Ordered: each item's release must see its own stamp's result.
  await MarketplaceListing.bulkWrite(items.flatMap((item) => confirmOps(item, now)), { ordered: true, strict: false });
  const rows = items.map((item) => {
    const stale = (lastPushed.get(String(item.listingId)) ?? 0) > item.sentSeq;
    if (stale) logger.info(`[asyncPublish] stale confirmation for listing ${item.listingId} (sent seq ${item.sentSeq}) — newer push already confirmed`);
    return stale
      ? logRow(data, item, CHANNEL_SYNC_LOG_STATUS.SKIPPED, { errorCode: "stale_seq" })
      : logRow(data, item, CHANNEL_SYNC_LOG_STATUS.SUCCESS);
  });
  await logSyncEvents(rows);
}

// Re-pushes any listing whose push_seq moved while its batch was in flight.
async function recoverChangedListings(platform, items) {
  const ids = items.map((i) => i.listingId);
  const rows = await MarketplaceListing.find({ _id: { $in: ids }, state: LISTING_STATE.ACTIVE }).select("push_seq").lean();
  const sentById = new Map(items.map((i) => [String(i.listingId), i.sentSeq]));
  for (const row of rows) {
    const current = row.push_seq ?? 0;
    if (current <= sentById.get(String(row._id))) continue;
    logger.info(`[asyncPublish] listing ${row._id} changed in flight (push_seq ${current}) — re-enqueueing`);
    await channelQueue.enqueueChannelJob(platform, CHANNEL_JOB.SYNC_LISTING, { listingId: String(row._id), seq: current }, { delay: 0 });
  }
}

/** Self-contained job data, so a worker restart can still resolve the batch. */
function buildCheckJobData(platform, tenantId, handle, items, kind, attempt = 0) {
  return { platform, tenantId: String(tenantId), handle, kind, attempt, items };
}

async function enqueueCheck(data) {
  await channelQueue.enqueueChannelJob(data.platform, CHANNEL_JOB.CHECK_BATCH_STATUS, data, {
    delay: checkDelayMs(data.attempt),
    // The job re-enqueues itself per attempt; Bull retries only real crashes.
    attempts: 3,
  });
}

/** Marks items ({ listingId, retailerId, sentSeq }) pending; adds a check. */
async function trackPendingBatch(platform, tenantId, handle, items) {
  const now = new Date();
  await MarketplaceListing.bulkWrite(
    items.map((i) => ({
      updateOne: {
        filter: { _id: i.listingId },
        update: {
          $set: {
            sync_status: LISTING_SYNC_STATUS.PENDING,
            sync_error: null,
            inflight_seq: i.sentSeq,
            inflight_at: now,
            ...(i.externalListingId ? { external_listing_id: i.externalListingId } : {}),
          },
        },
      },
    })),
    { strict: false },
  );
  try {
    await enqueueCheck(buildCheckJobData(platform, tenantId, handle, items.map(toJobItem), ASYNC_BATCH_KIND.PUSH));
  } catch (err) {
    // NOTE: without a status check the listings would sit pending forever.
    logger.error(`[asyncPublish] could not schedule status check for ${platform} batch ${handle}: ${err.message}`);
    const data = buildCheckJobData(platform, tenantId, handle, items.map(toJobItem), ASYNC_BATCH_KIND.PUSH);
    await failAll(data, `Could not schedule Meta status check: ${err.message}`, "status_check_unscheduled");
  }
}

function toJobItem(i) {
  return { listingId: String(i.listingId), retailerId: i.retailerId, sentSeq: i.sentSeq, quantity: i.quantity ?? null };
}

/** Schedules the status check for an async end() (delete); nothing to stamp. */
async function trackPendingEnd(platform, tenantId, handle, item) {
  await enqueueCheck(buildCheckJobData(platform, tenantId, handle, [toJobItem(item)], ASYNC_BATCH_KIND.END));
}

async function failAll(data, message, errorCode) {
  await failItems(data, data.items.map((item) => ({ item, message, errorCode })));
}

// Next attempt, or give up with every listing errored (never stuck pending).
async function retryOrGiveUp(data, reason) {
  const next = data.attempt + 1;
  if (next < config.channels.batchStatusMaxAttempts) {
    await enqueueCheck({ ...data, attempt: next });
    return { pending: true, attempt: next };
  }
  const message = `Meta did not confirm batch ${data.handle} after ${next} status checks (${reason})`;
  logger.error(`[asyncPublish] ${data.platform}/${data.tenantId}: ${message}`);
  await failAll(data, message, "batch_status_timeout");
  return { timedOut: true };
}

async function applyFinishedStatus(data, status) {
  // NOTE: errors Meta didn't attribute to an id fail every unnamed item.
  const unattributed = status.unattributedErrors > 0
    ? `Meta reported ${status.unattributedErrors} error(s) in batch ${data.handle} without naming the items` : null;
  const failures = [];
  const succeeded = [];
  for (const item of data.items) {
    const message = status.failures.get(String(item.retailerId)) ?? unattributed;
    if (message) failures.push({ item, message });
    else succeeded.push(item);
  }
  await failItems(data, failures);
  if (data.kind === ASYNC_BATCH_KIND.PUSH) {
    await confirmItems(data, succeeded);
    await recoverChangedListings(data.platform, data.items);
  }
  return { done: true, succeeded: succeeded.length, failed: failures.length };
}

/** check_batch_status job body; reads nothing but the job data and the DB. */
async function processCheckBatchStatus(data) {
  const adapter = getAdapter(data.platform);
  const settings = await adapter.loadSettings(data.tenantId);
  if (settings === null) {
    await failAll(data, "Platform not connected", "not_connected");
    return { skipped: true, reason: "not_connected" };
  }
  let status;
  try {
    status = await adapter.checkBatchStatus(data.handle, settings);
  } catch (err) {
    const flagged = await flagIfPrerequisiteError(data.tenantId, adapter.key, adapter.manifest, err);
    if (flagged) {
      await failAll(data, flagged.message, flagged.reason);
      return { skipped: true, reason: flagged.reason };
    }
    await circuitBreaker.recordFailure(data.tenantId, adapter.key, err);
    return retryOrGiveUp(data, err.message);
  }
  await circuitBreaker.recordSuccess(data.tenantId, adapter.key);
  if (!status.done) return retryOrGiveUp(data, `last status: ${status.status ?? "unknown"}`);
  return applyFinishedStatus(data, status);
}

module.exports = {
  isAsyncAdapter,
  hasLiveInflightBatch,
  inflightWindowMs,
  checkDelayMs,
  trackPendingBatch,
  trackPendingEnd,
  processCheckBatchStatus,
};
