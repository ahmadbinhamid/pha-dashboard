// constants/channel.constants.js
// Shared constants for the channel-agnostic adapter/queue/log layer.

const CHANNEL_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  // OAuth consent succeeded and a token is saved, but the tenant hasn't picked a Merchant
  // Center account yet; never treated as "connected" since assertConfigured requires merchant_id.
  PENDING: "pending",
  // Circuit breaker tripped from repeated transport/auth failures; pauses queue processing for
  // the platform (not a hard failure) and self-clears via the resume path.
  DEGRADED: "degraded",
  ERROR: "error",
});

const CHANNEL_SYNC_LOG_STATUS = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  SKIPPED: "skipped",
});

module.exports = { CHANNEL_CONNECTION_STATUS, CHANNEL_SYNC_LOG_STATUS };
