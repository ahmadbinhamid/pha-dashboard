// src/queues/channel.queue.js
// One Bull queue per platform, so a slow platform never blocks another's jobs.

const Queue = require("bull");
const config = require("../config");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");

const redisOpts = buildRedisOptions();

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

// Real enqueue (tests mock the wrapper); bypassDebounce forces a fresh job.
async function enqueueChannelJobDirect(platform, jobName, payload, opts = {}) {
  const queue = getQueue(platform);
  const { bypassDebounce, ...restOpts } = opts;
  const jobOpts = { ...DEFAULT_JOB_OPTS, ...restOpts };

  // Debounced per listing; safe because the job re-reads push_seq when it runs.
  if (jobName === "sync_listing" && payload?.listingId && !bypassDebounce) {
    const jobId = `sync:${platform}:${payload.listingId}`;

    // add() returns a same-id job in ANY state, so clear terminal ones first.
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") await existing.remove();
    }

    Object.assign(jobOpts, {
      jobId,
      delay: opts.delay ?? config.channels.debounceMs,
      removeOnComplete: true,
      // Required: a failed job kept under this id silences the listing forever.
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
