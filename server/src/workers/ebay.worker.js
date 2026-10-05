// src/workers/ebay.worker.js
// channel.worker.js limited to "ebay"; keeps the old compose entry booting.

const { startChannelWorker, shutdown } = require("./channel.worker");
const { logger } = require("../loaders/logging");
const { onShutdownSignals } = require("../utils/gracefulShutdown");

startChannelWorker({ platforms: ["ebay"] }).catch((err) => {
  logger.error(`[ebayWorker] failed to start: ${err.message}`);
  process.exit(1);
});

onShutdownSignals(shutdown);
