// src/queues/search.queue.js

const Queue = require("bull");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");

const redisOpts = buildRedisOptions();

// Lazy, as in email.queue.js: requiring must not open a Redis socket.
let _searchQueue = null;
function ensureSearchQueue() {
  if (_searchQueue) return _searchQueue;
  _searchQueue = new Queue("search", { redis: redisOpts });
  _searchQueue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error("[searchQueue] unexpected error", { error: err.message, stack: err.stack });
  });
  return _searchQueue;
}

// Fire-and-forget: a slow Redis or Typesense must never block a product save.
async function enqueueSearchJob(type, payload, opts = {}) {
  const job = ensureSearchQueue().add(type, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    timeout: 30_000,
    ...opts,
  });

  const deadline = new Promise((_, rej) =>
    setTimeout(
      () => rej(new Error("Search queue unavailable: Redis not reachable")),
      4000,
    ),
  );

  return Promise.race([job, deadline]);
}

module.exports = {
  get searchQueue() {
    return ensureSearchQueue();
  },
  enqueueSearchJob,
};
