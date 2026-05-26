// src/queues/ebay.queue.js

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

const ebayQueue = new Queue("ebay", { redis: redisOpts });

ebayQueue.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
  logger.error("[ebayQueue] unexpected error", { error: err.message, stack: err.stack });
});

async function enqueueEbayJob(type, payload, opts = {}) {
  const job = ebayQueue.add(type, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    timeout: 60_000,
    ...opts,
  });

  const deadline = new Promise((_, rej) =>
    setTimeout(
      () => rej(new Error("eBay queue unavailable: Redis not reachable")),
      4000,
    ),
  );

  return Promise.race([job, deadline]);
}

module.exports = { ebayQueue, enqueueEbayJob };
