// services/marketplace/sync-log.service.js
// ChannelSyncLog writes shared by the sync and async-publish services.

const { logger } = require("../../loaders/logging");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const config = require("../../config");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

function shouldLog(status) {
  return status === CHANNEL_SYNC_LOG_STATUS.FAILURE || config.channels.logSuccesses;
}

function toLogDoc({ tenantId, platform, jobType, entityId, status, attempt, errorCode, errorMessage, errorStatus, requestSummary, durationMs }) {
  return {
    tenant_id: tenantId,
    platform,
    job_type: jobType,
    entity_type: "MarketplaceListing",
    entity_id: entityId,
    status,
    attempt: attempt ?? 1,
    error_code: errorCode ?? null,
    error_message: errorMessage ?? null,
    error_status: Number.isInteger(errorStatus) ? errorStatus : null,
    request_summary: requestSummary ?? null,
    duration_ms: durationMs ?? null,
  };
}

// Never throws: a log failure mustn't break the job; non-failures are opt-in.
async function logSyncEvent(event) {
  if (!shouldLog(event.status)) return;
  try {
    await ChannelSyncLog.create(toLogDoc(event));
  } catch (err) {
    logger.warn(`[marketplace.sync] failed to write ChannelSyncLog for ${event.jobType}/${event.entityId}: ${err.message}`);
  }
}

/** Batched logSyncEvent: one insertMany, same rules, never throws. */
async function logSyncEvents(events) {
  const docs = events.filter((e) => shouldLog(e.status)).map(toLogDoc);
  if (!docs.length) return;
  try {
    await ChannelSyncLog.insertMany(docs, { ordered: false });
  } catch (err) {
    logger.warn(`[marketplace.sync] failed to write ${docs.length} ChannelSyncLog row(s): ${err.message}`);
  }
}

module.exports = { logSyncEvent, logSyncEvents };
