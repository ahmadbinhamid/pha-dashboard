// services/marketplace/circuitBreaker.js
// Per-(tenant, platform) circuit breaker backed by ChannelConnection, checked by sync.service.js before
// each adapter call. Deliberately not a Bull queue.pause(), which would stall every tenant on that platform.

const ChannelConnection = require("../../models/ChannelConnection");
const { logger } = require("../../loaders/logging");
const config = require("../../config");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");

// Only transport/auth failures (5xx, network error, 401/403) count; 400-level product data
// errors never trip the breaker. Duck-typed on .status/.statusCode so any adapter can use this.
function isTransportOrAuthFailure(err) {
  const status = err?.status ?? err?.statusCode;
  if (status != null) return status >= 500 || status === 401 || status === 403;
  // No HTTP status at all — a thrown network/timeout error, treated as transport-level.
  return true;
}

async function recordSuccess(tenantId, platform) {
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform },
    {
      $set: { consecutive_failures: 0, last_success_at: new Date(), status: CHANNEL_CONNECTION_STATUS.CONNECTED, last_error: null },
    },
  );
}

// Returns { tripped } so callers can act on the transition itself. upsert: true relies on the
// adapter's loadSettings already having migrated a full ChannelConnection row before this runs —
// a new adapter must resolve settings before calling recordFailure, or this creates a bare row.
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

// Explicit resume path used by the reconnect/manual-sync flow to clear a tripped breaker.
async function resume(tenantId, platform) {
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform },
    { $set: { status: CHANNEL_CONNECTION_STATUS.CONNECTED, consecutive_failures: 0, last_error: null } },
  );
  logger.info(`[circuitBreaker] ${platform}/${tenantId}: resumed`);
}

module.exports = { isTransportOrAuthFailure, recordSuccess, recordFailure, isOpen, resume };
