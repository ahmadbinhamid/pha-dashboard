// services/marketplace/circuitBreaker.js
// Per-(tenant, platform) breaker; not queue.pause(), which stalls all tenants.

const ChannelConnection = require("../../models/ChannelConnection");
const { logger } = require("../../loaders/logging");
const config = require("../../config");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");

// Node/undici codes; fetch puts them on err.cause or inside an AggregateError.
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EPIPE",
  "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
]);
// fetch aborts are DOMExceptions identified by name, not code.
const ABORT_ERROR_NAMES = new Set(["AbortError", "TimeoutError"]);
const MAX_CAUSE_DEPTH = 4;

function isNetworkFailure(err, depth = 0) {
  if (!err || depth > MAX_CAUSE_DEPTH) return false;
  // NOTE: our own DB failing isn't the channel's transport; never trip on it.
  if (typeof err.name === "string" && err.name.startsWith("Mongo")) return false;
  if (NETWORK_ERROR_CODES.has(err.code) || ABORT_ERROR_NAMES.has(err.name)) return true;
  if (Array.isArray(err.errors) && err.errors.some((e) => isNetworkFailure(e, depth + 1))) return true;
  return isNetworkFailure(err.cause, depth + 1);
}

// Positive match only: network error, 5xx, 401 or 403; nothing else trips.
function isTransportOrAuthFailure(err) {
  const status = Number(err?.status ?? err?.statusCode);
  if (Number.isInteger(status) && status > 0) return status >= 500 || status === 401 || status === 403;
  return isNetworkFailure(err);
}

async function recordSuccess(tenantId, platform) {
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform },
    {
      $set: {
        consecutive_failures: 0,
        last_success_at: new Date(),
        status: CHANNEL_CONNECTION_STATUS.CONNECTED,
        last_error: null,
        status_reason: null,
      },
    },
  );
}

// upsert assumes loadSettings already made the row, else inserts a bare one.
async function recordFailure(tenantId, platform, err) {
  if (!isTransportOrAuthFailure(err)) return { tripped: false, counted: false };

  const threshold = config.channels.circuitBreakerThreshold;
  const updated = await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform },
    { $inc: { consecutive_failures: 1 }, $set: { last_error: err.message } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const failures = updated?.consecutive_failures ?? 0;
  if (failures < threshold) return { tripped: false, counted: true };

  if (updated.status !== CHANNEL_CONNECTION_STATUS.DEGRADED) {
    await ChannelConnection.updateOne(
      { tenant_id: tenantId, platform },
      { $set: { status: CHANNEL_CONNECTION_STATUS.DEGRADED, last_error: err.message } },
    );
    logger.error(`[circuitBreaker] ${platform}/${tenantId}: tripped after ${failures} consecutive transport/auth failures — pausing sync for this tenant`);
  }
  return { tripped: true, counted: true };
}

async function isOpen(tenantId, platform) {
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform }).select("status").lean();
  return conn?.status === CHANNEL_CONNECTION_STATUS.DEGRADED;
}

// Clears a tripped breaker on reconnect or manual sync.
async function resume(tenantId, platform) {
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform },
    { $set: { status: CHANNEL_CONNECTION_STATUS.CONNECTED, consecutive_failures: 0, last_error: null, status_reason: null } },
  );
  logger.info(`[circuitBreaker] ${platform}/${tenantId}: resumed`);
}

module.exports = { isTransportOrAuthFailure, recordSuccess, recordFailure, isOpen, resume };
