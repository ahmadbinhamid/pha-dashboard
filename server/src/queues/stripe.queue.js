// src/queues/stripe.queue.js

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

const stripeQueue = new Queue("stripe", { redis: redisOpts });

stripeQueue.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
  logger.error("[stripeQueue] unexpected error", { error: err.message, stack: err.stack });
});

module.exports = { stripeQueue };
