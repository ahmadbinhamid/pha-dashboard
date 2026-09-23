// models/ChannelSyncLog.js
// Append-only audit trail for channel adapter jobs. Failures always logged in full; successes
// only when config.channels.logSuccesses is set. TTL index drops rows past syncLogTtlDays.

const { Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const config = require("../config");
const { CHANNEL_SYNC_LOG_STATUS } = require("../constants/channel.constants");

const channelSyncLogSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    platform: { type: String, required: true },
    job_type: { type: String, required: true },
    entity_type: { type: String, default: null },
    entity_id: { type: Schema.Types.ObjectId, default: null },

    status: {
      type: String,
      enum: Object.values(CHANNEL_SYNC_LOG_STATUS),
      required: true,
    },
    attempt: { type: Number, default: 1 },
    error_code: { type: String, default: null },
    error_message: { type: String, default: null },
    // Small, non-sensitive snapshot for debugging, never the raw payload (can carry credentials/PII).
    request_summary: { type: Schema.Types.Mixed, default: null },
    duration_ms: { type: Number, default: null },
  },
  { softDelete: false },
);

channelSyncLogSchema.index({ tenant_id: 1, platform: 1, created_at: -1 });
// expireAfterSeconds is fixed at index-creation time; a changed syncLogTtlDays only takes
// effect for a new index (drop + recreate), not retroactively.
channelSyncLogSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: config.channels.syncLogTtlDays * 24 * 60 * 60, background: true },
);

module.exports = require("mongoose").model("ChannelSyncLog", channelSyncLogSchema);
