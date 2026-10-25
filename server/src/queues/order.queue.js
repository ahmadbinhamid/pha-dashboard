// src/queues/order.queue.js

const Queue = require("bull");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");

const redisOpts = buildRedisOptions();

// Lazy, as in email.queue.js: requiring must not open a Redis socket.
let _orderQueue = null;
function ensureOrderQueue() {
  if (_orderQueue) return _orderQueue;
  _orderQueue = new Queue("order", { redis: redisOpts });
  _orderQueue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error("[orderQueue] unexpected error", { error: err.message, stack: err.stack });
  });
  return _orderQueue;
}

module.exports = {
  get orderQueue() {
    return ensureOrderQueue();
  },
};
