// src/queues/channel.queue.js
// Channel-agnostic job queues, keyed by platform — each gets its own Bull queue so a slow
// platform never head-of-line blocks another's jobs. eBay's queue must keep its exact Bull
// queue/job names so already-queued Redis jobs aren't orphaned on deploy.

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

// Lazily creates (and caches) the Bull queue for a platform.
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

// Real enqueue; exported so tests mocking enqueueChannelJob can still reach Bull.
// opts.bypassDebounce: true skips the debounce jobId/delay so a manual retry always enqueues,
// never collapsing into whatever debounced job already exists for that listing.
async function enqueueChannelJobDirect(platform, jobName, payload, opts = {}) {
  const queue = getQueue(platform);
  const { bypassDebounce, ...restOpts } = opts;
  const jobOpts = { ...DEFAULT_JOB_OPTS, ...restOpts };

  // Debounce: collapse rapid-fire sync_listing calls for the same listing into one delayed
  // job, keyed by listing id. Safe because the eventual job re-reads the current push_seq at
  // execution time rather than trusting whichever payload happened to win the dedup.
  if (jobName === "sync_listing" && payload?.listingId && !bypassDebounce) {
    const jobId = `sync:${platform}:${payload.listingId}`;

    // Bull gotcha (verified bull@4.16.5): add() returns the existing job for a jobId in any
    // state, including failed, rather than creating a new one. removeOnFail: true is required —
    // a failed job left under this id would make every subsequent call for that listing a
    // silent no-op forever, since ChannelSyncLog is the durable failure record, not Bull.
    // Defensively also clear any pre-existing terminal job under this id, from before the fix.
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") await existing.remove();
    }

    Object.assign(jobOpts, {
      jobId,
      delay: opts.delay ?? config.channels.debounceMs,
      removeOnComplete: true,
      removeOnFail: true,
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

async function enqueueChannelJob(platform, jobName, payload, opts = {}) {
  return enqueueChannelJobDirect(platform, jobName, payload, opts);
}

module.exports = { queues, getQueue, enqueueChannelJob, enqueueChannelJobDirect };
