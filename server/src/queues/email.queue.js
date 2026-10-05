// src/queues/email.queue.js

const Queue = require("bull");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");

const redisOpts = buildRedisOptions();

// Lazy: a Queue opens a socket at once, which hung tests on a mere require.
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
