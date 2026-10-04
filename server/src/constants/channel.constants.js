// constants/channel.constants.js
// Shared constants for the channel-agnostic adapter/queue/log layer.

const CHANNEL_CONNECTION_STATUS = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  // OAuth done, no Merchant Center account picked; assertConfigured blocks sync.
  PENDING: "pending",
  // Breaker tripped by transport/auth failures; cleared by the resume path.
  DEGRADED: "degraded",
  // Needs attention; status_reason, when set, names the unmet prerequisite.
  ERROR: "error",
});

// Why a connection is ERROR; each names what the tenant must fix.
const CHANNEL_STATUS_REASON = Object.freeze({
  STOREFRONT_REQUIRED: "storefront_required",
  // Refresh token revoked/expired; only a fresh OAuth connect clears it.
  REAUTHENTICATION_REQUIRED: "reauthentication_required",
});

// err.code for a sync failure caused by an unmet channel prerequisite.
const CHANNEL_PREREQUISITE_ERROR_CODE = "CHANNEL_PREREQUISITE_UNMET";
// err.code for a token refresh refused with invalid_grant.
const CHANNEL_REAUTH_ERROR_CODE = "CHANNEL_REAUTH_REQUIRED";

const CHANNEL_SYNC_LOG_STATUS = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  SKIPPED: "skipped",
});

module.exports = {
  CHANNEL_CONNECTION_STATUS,
  CHANNEL_SYNC_LOG_STATUS,
  CHANNEL_STATUS_REASON,
  CHANNEL_PREREQUISITE_ERROR_CODE,
  CHANNEL_REAUTH_ERROR_CODE,
};
