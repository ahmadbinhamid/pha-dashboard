// src/queues/channel.queue.js
//
// Channel-agnostic job queues, keyed by platform — see
// server/docs/channel-architecture.md for the full picture. Each platform
// gets its own Bull queue so a slow/rate-limited platform (Google Shopping,
// Meta Shop, added later) never head-of-line blocks another's jobs.
//
// eBay's queue is a special case: it MUST keep the exact Bull queue name
// ("ebay") and job names ("sync_listing", "poll_orders", "poll_inventory")
// queues/ebay.queue.js has always used — there may be jobs already sitting
// in Redis at deploy time, and renaming the queue would orphan them (nothing
// would ever process them again). See ebay.queue.js, kept as a thin
// backward-compatible re-export of this module's "ebay" queue for anything
// that still imports it directly.

const Queue = require("bull");
const config = require("../config");
const { logger } = require("../loaders/logging");

const redisOpts = {
  ...(config.redis.url
    ? { url: config.redis.url }
    : { host: config.redis.host, port: config.redis.port }),
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
};

// Per-platform Bull queue name. "ebay" MUST stay "ebay" — see module header.
const QUEUE_NAMES = {
  ebay: "ebay",
};

function nameFor(platform) {
  return QUEUE_NAMES[platform] || `channel:${platform}`;
}

function limiterFor(platform) {
  return config.channels.rateLimits[platform] || null;
}

const queues = new Map();

// Lazily creates (and caches) the Bull queue for a platform. Called by
// enqueueChannelJobDirect below, and by workers/channel.worker.js to attach
// a processor for every registered adapter's platform.
function getQueue(platform) {
  let queue = queues.get(platform);
  if (queue) return queue;

  const limiter = limiterFor(platform);
  queue = new Queue(nameFor(platform), { redis: redisOpts, ...(limiter ? { limiter } : {}) });
  queue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error(`[channelQueue:${platform}] unexpected error`, { error: err.message, stack: err.stack });
  });
  queues.set(platform, queue);
  return queue;
}

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: true,
  timeout: 60_000,
};

// The actual enqueue implementation — always adds to the real Bull queue for
// `platform`, ignoring any registered override (see registerEnqueueOverride
// below). ebay.queue.js's enqueueEbayJob calls this directly (never the
// override-checking enqueueChannelJob) so registering itself as eBay's
// override can never recurse back into itself.
async function enqueueChannelJobDirect(platform, jobName, payload, opts = {}) {
  const queue = getQueue(platform);
  const jobOpts = { ...DEFAULT_JOB_OPTS, ...opts };

  // Debounce: collapse rapid-fire sync_listing calls for the SAME listing
  // into one delayed job, keyed by listing id (not by payload) — a fresh
  // call arriving while an earlier one is still delayed is a no-op (Bull's
  // normal "a job with this id already exists" behavior). That's fine here:
  // the eventual job re-reads the listing's CURRENT push_seq at execution
  // time rather than trusting whichever payload happened to win (see
  // sync.service.js#syncListing and inventory.service.js#fanOutMarketplaceInventory),
  // so which of the N calls' payload "wins" the dedup doesn't matter.
  //
  // Bull gotcha (verified for bull@4.16.5, this repo's pinned version — see
  // package.json): a completed job with a custom jobId stays in Redis's
  // "completed" set unless removeOnComplete is true — a later .add() with
  // the SAME jobId is then silently ignored (Bull still considers that id
  // "taken" and just returns the old completed job; it never runs again).
  // removeOnComplete: true is what actually frees the id back up for the
  // next debounce window. removeOnFail stays false so a failed debounced
  // job is still visible/retryable rather than vanishing.
  if (jobName === "sync_listing" && payload?.listingId) {
    Object.assign(jobOpts, {
      jobId: `sync:${platform}:${payload.listingId}`,
      delay: opts.delay ?? config.channels.debounceMs,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  const job = queue.add(jobName, payload, jobOpts);

  const deadline = new Promise((_, rej) =>
    setTimeout(
      () => rej(new Error(`${nameFor(platform)} queue unavailable: Redis not reachable`)),
      4000,
    ),
  );

  return Promise.race([job, deadline]);
}

// Lets a platform's own queue module supply its OWN enqueue function instead
// of the generic one above, while every caller still goes through the one
// enqueueChannelJob(platform, ...) entry point (see
// inventory.service.js#fanOutMarketplaceInventory). This exists purely for
// eBay's backward-compatibility shim (see ebay.queue.js): several
// pre-existing tests mock ebay.queue.js's enqueueEbayJob directly (e.g.
// ebay.inventory-sync.service.test.js) and must keep intercepting real
// eBay-bound enqueue calls even though the generic fan-out now calls
// enqueueChannelJob, not enqueueEbayJob, directly. No other platform needs
// this — it's a no-op unless something registers an override for that key.
const enqueueOverrides = new Map();
function registerEnqueueOverride(platform, fn) {
  enqueueOverrides.set(platform, fn);
}

async function enqueueChannelJob(platform, jobName, payload, opts = {}) {
  const override = enqueueOverrides.get(platform);
  if (override) return override(jobName, payload, opts);
  return enqueueChannelJobDirect(platform, jobName, payload, opts);
}

module.exports = { queues, getQueue, enqueueChannelJob, enqueueChannelJobDirect, registerEnqueueOverride };
