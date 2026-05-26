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

const emailQueue = new Queue("email", { redis: redisOpts });

emailQueue.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
  logger.error("[emailQueue] unexpected error", { error: err.message, stack: err.stack });
});

async function enqueueEmailJob(payload, opts = {}) {
  const job = emailQueue.add("send", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
    timeout: 30000,
    ...opts,
  });

  // Fail fast if Redis is unreachable — don't block the request for 97s
  const deadline = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("Email queue unavailable: Redis not reachable")), 4000)
  );
  return Promise.race([job, deadline]);
}

module.exports = { emailQueue, enqueueEmailJob };
