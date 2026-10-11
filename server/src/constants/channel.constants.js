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

// NOTE: backend owns remedy text and links; the UI renders what it sends.
const CHANNEL_REMEDY_LOCATION = Object.freeze({
  DOMAINS: Object.freeze({ place: "Settings › Integrations › Custom Domains", href: "/settings/integrations/domains" }),
});

// Manifest `status`; the UI shows COMING_SOON channels but can't connect them.
const CHANNEL_RELEASE_STATUS = Object.freeze({ ACTIVE: "active", COMING_SOON: "coming_soon" });

// Queue job names shared by producers and the channel worker.
const CHANNEL_JOB = Object.freeze({
  SYNC_LISTING: "sync_listing",
  SYNC_BATCH: "sync_batch",
  CHECK_BATCH_STATUS: "check_batch_status",
});

// What an async channel batch did: pushed items, or deleted one (end).
const ASYNC_BATCH_KIND = Object.freeze({ PUSH: "push", END: "end" });

// Default dev placeholder for every channel; PNG 800x800, verified by fetch.
const DEV_FALLBACK_IMAGE = Object.freeze({ url: "https://placehold.co/800x800.png", width: 800, height: 800 });

module.exports = {
  CHANNEL_REMEDY_LOCATION,
  CHANNEL_JOB,
  CHANNEL_RELEASE_STATUS,
  ASYNC_BATCH_KIND,
  DEV_FALLBACK_IMAGE,
  CHANNEL_CONNECTION_STATUS,
  CHANNEL_SYNC_LOG_STATUS,
  CHANNEL_STATUS_REASON,
  CHANNEL_PREREQUISITE_ERROR_CODE,
  CHANNEL_REAUTH_ERROR_CODE,
};
