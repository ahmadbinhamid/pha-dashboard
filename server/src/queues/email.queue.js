// src/queues/email.queue.js

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

// Constructed lazily, on first real access, rather than eagerly at module load. Found live:
// `new Queue(...)` opens a real, never-closed ioredis connection, so merely requiring this
// file (transitively, via any service that sends email) left a Redis socket open for the
// process's life, hanging several test files. Getter-based so existing call sites keep working
// unchanged — only the construction timing moves from require() to first property access.
let _emailQueue = null;
function ensureEmailQueue() {
  if (_emailQueue) return _emailQueue;
  _emailQueue = new Queue("email", { redis: redisOpts });
  _emailQueue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error("[emailQueue] unexpected error", { error: err.message, stack: err.stack });
  });
  return _emailQueue;
}

async function enqueueEmailJob(payload, opts = {}) {
  const job = ensureEmailQueue().add("send", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
    timeout: 30000,
    ...opts,
  });

  // Fail fast if Redis is unreachable, don't block the request for 97s.
  const deadline = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("Email queue unavailable: Redis not reachable")), 4000)
  );
  return Promise.race([job, deadline]);
}

module.exports = {
  get emailQueue() {
    return ensureEmailQueue();
  },
  enqueueEmailJob,
};
