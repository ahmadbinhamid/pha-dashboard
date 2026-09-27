// src/workers/ebay.worker.js
// Thin delegate to channel.worker.js restricted to "ebay", kept as a separate entry point so
// the old docker-compose keeps booting until it's updated. All job processing lives there now.

const { startChannelWorker, shutdown } = require("./channel.worker");
const { logger } = require("../loaders/logging");

startChannelWorker({ platforms: ["ebay"] }).catch((err) => {
  logger.error(`[ebayWorker] failed to start: ${err.message}`);
  process.exit(1);
});

// shutdown() already contains its own try/catch + process.exit(), so this never actually rejects.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
