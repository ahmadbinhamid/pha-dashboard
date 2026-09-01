// constants/channel.constants.js
//
// Shared constants for the channel-agnostic adapter/queue/log layer — see
// server/docs/channel-architecture.md.

const CHANNEL_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  // Circuit breaker tripped — repeated transport/auth failures (see
  // ChannelConnection.js#consecutive_failures). Not a hard failure state:
  // queue processing for the platform is paused, not the connection itself
  // being wrong, and it self-clears via the resume path once the tenant
  // (or an automated retry) confirms the platform is healthy again.
  DEGRADED: "degraded",
  ERROR: "error",
});

const CHANNEL_SYNC_LOG_STATUS = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  SKIPPED: "skipped",
});

module.exports = { CHANNEL_CONNECTION_STATUS, CHANNEL_SYNC_LOG_STATUS };
