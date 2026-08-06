// src/queues/search.queue.js

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

const searchQueue = new Queue("search", { redis: redisOpts });

searchQueue.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
  logger.error("[searchQueue] unexpected error", { error: err.message, stack: err.stack });
});

// Fire-and-forget from product CRUD (see product.controller.js) — a slow or
// unreachable Redis/Typesense must never block a product save.
async function enqueueSearchJob(type, payload, opts = {}) {
  const job = searchQueue.add(type, payload, {
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

module.exports = { searchQueue, enqueueSearchJob };
