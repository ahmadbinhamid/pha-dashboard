// utils/gracefulShutdown.js
// Worker SIGTERM/SIGINT: stop new jobs, drain in-flight (bounded), close, exit.

const mongoose = require("mongoose");
const config = require("../config");
const { logger: defaultLogger } = require("../loaders/logging");

// Extra time for queue/Mongo closes after the drain before a forced exit.
const CLOSE_GRACE_MS = 2000;

// Resolves true if `promise` is still pending after `ms`.
function timedOut(promise, ms) {
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(true), ms);
  });
  return Promise.race([promise.then(() => false), deadline]).finally(() => clearTimeout(timer));
}

/** Builds shutdown(signal) for a worker; getQueues runs at signal time. */
function createShutdown({
  name,
  getQueues,
  timeoutMs = config.workers.shutdownTimeoutMs,
  closeConnections = () => mongoose.connection.close(),
  exit = (code) => process.exit(code),
  logger = defaultLogger,
}) {
  let shuttingDown = false;

  return async function shutdown(signal) {
    if (shuttingDown) {
      logger.warn(`[${name}] second ${signal} — forcing exit`);
      return exit(1);
    }
    shuttingDown = true;
    logger.info(`[${name}] ${signal} received — stopping new jobs, waiting up to ${timeoutMs}ms for in-flight jobs`);

    // A close or Mongo hang must never keep the process alive.
    const hardStop = setTimeout(() => {
      logger.error(`[${name}] shutdown hung past its deadline — forcing exit`);
      exit(1);
    }, timeoutMs + CLOSE_GRACE_MS);
    hardStop.unref?.();

    try {
      const queues = getQueues();
      // pause(true): this worker stops taking jobs, resolves once its own finish.
      const drainTimedOut = await timedOut(Promise.all(queues.map((q) => q.pause(true))), timeoutMs);
      // NOTE: a job still running here is left to Bull's stalled-job retry.
      if (drainTimedOut) logger.warn(`[${name}] in-flight jobs outlasted ${timeoutMs}ms — closing anyway`);
      await Promise.all(queues.map((q) => q.close(drainTimedOut)));
      await closeConnections();
      clearTimeout(hardStop);
      logger.info(`[${name}] shutdown complete`);
      return exit(0);
    } catch (err) {
      clearTimeout(hardStop);
      logger.error(`[${name}] error during shutdown: ${err.message}`);
      return exit(1);
    }
  };
}

/** Runs shutdown on SIGTERM and SIGINT. */
function onShutdownSignals(shutdown) {
  // shutdown handles its own errors and always exits, so it never rejects.
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  return shutdown;
}

/** createShutdown plus the signal handlers; returns shutdown. */
function installGracefulShutdown(options) {
  return onShutdownSignals(createShutdown(options));
}

module.exports = { createShutdown, onShutdownSignals, installGracefulShutdown };
