// src/queues/stripe.queue.js

const Queue = require("bull");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");

const redisOpts = buildRedisOptions();

// Lazy, as in email.queue.js: requiring must not open a Redis socket.
let _stripeQueue = null;
function ensureStripeQueue() {
  if (_stripeQueue) return _stripeQueue;
  _stripeQueue = new Queue("stripe", { redis: redisOpts });
  _stripeQueue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error("[stripeQueue] unexpected error", { error: err.message, stack: err.stack });
  });
  return _stripeQueue;
}

module.exports = {
  get stripeQueue() {
    return ensureStripeQueue();
  },
};
