// services/marketplace/channel.service.js
// DB-facing logic behind GET /api/v1/channels* (HTTP in channel.controller.js).

const registry = require("./registry");
const ChannelConnection = require("../../models/ChannelConnection");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { enqueueChannelJob } = require("../../queues/channel.queue");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const { LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");
const { withStaticOptions } = require("./fieldSchema");
const { findUnmetPrerequisite, prerequisiteMessage } = require("./channelPrerequisite.service");

function storefrontUnavailableReason(manifestName) {
  return `${manifestName} requires a verified storefront domain — connect and verify one under Settings > Domains before connecting ${manifestName}.`;
}

// Driven by manifest.requiresStorefront, so new adapters need no code here.
async function checkStorefrontRequirement(tenantId, platform) {
  const { manifest } = registry.get(platform);
  const unmet = await findUnmetPrerequisite(tenantId, manifest);
  return unmet ? { ok: false, reason: storefrontUnavailableReason(manifest.name) } : { ok: true };
}

// All adapter manifests plus tenant status; unconnected ones can show Connect.
async function listChannelsForTenant(tenantId) {
  const manifests = registry.list();

  // Resolved once per tenant, only if some registered platform needs it.
  const anyRequiresStorefront = manifests.some((m) => m.requiresStorefront);
  const [connections, listingCounts, hasVerifiedDomain] = await Promise.all([
    ChannelConnection.find({ tenant_id: tenantId }).lean(),
    // Max lastSyncedAt over all statuses, so an errored channel still shows a time.
    MarketplaceListing.aggregate([
      { $match: { tenant_id: tenantId } },
      {
        $group: {
          _id: { platform: "$platform", sync_status: "$sync_status" },
          count: { $sum: 1 },
          lastSyncedAt: { $max: "$synced_at" },
        },
      },
    ]),
    anyRequiresStorefront ? require("../domain.service").hasVerifiedDefaultDomain(tenantId) : Promise.resolve(true),
  ]);

  const connByPlatform = new Map(connections.map((c) => [c.platform, c]));
  const countsByPlatform = new Map();
  const lastSyncedAtByPlatform = new Map();
  for (const row of listingCounts) {
    const { platform, sync_status } = row._id;
    if (!countsByPlatform.has(platform)) countsByPlatform.set(platform, {});
    countsByPlatform.get(platform)[sync_status] = row.count;

    if (row.lastSyncedAt) {
      const current = lastSyncedAtByPlatform.get(platform);
      if (!current || row.lastSyncedAt > current) lastSyncedAtByPlatform.set(platform, row.lastSyncedAt);
    }
  }

  return manifests.map((manifest) => {
    const adapter = registry.get(manifest.key);
    const conn = connByPlatform.get(manifest.key) || null;

    // Missing storefront requirement: mark unavailable with a readable reason.
    const storefrontOk = !manifest.requiresStorefront || hasVerifiedDomain;
    const listingCountsForPlatform = countsByPlatform.get(manifest.key) || {};
    const consecutiveFailures = conn?.consecutive_failures || 0;

    // The two LISTING_SYNC_STATUS values meaning this listing is actually broken.
    const needsAttentionCount =
      (listingCountsForPlatform[LISTING_SYNC_STATUS.ERROR] || 0) +
      (listingCountsForPlatform[LISTING_SYNC_STATUS.PRICE_LOCKED] || 0);

    // Listing + connection trouble; mirrors dashboard getPlatformChannelHealth.
    const healthStatus =
      needsAttentionCount > 0 ||
      conn?.status === CHANNEL_CONNECTION_STATUS.DEGRADED ||
      conn?.status === CHANNEL_CONNECTION_STATUS.ERROR ||
      consecutiveFailures > 0
        ? "needs_attention"
        : "healthy";

    return {
      ...manifest,
      // Additive: channel-only form fields with static options.
      fieldSchema: withStaticOptions(manifest.fieldSchema),
      capabilities: adapter.capabilities,
      available: storefrontOk,
      unavailable_reason: storefrontOk ? null : storefrontUnavailableReason(manifest.name),
      connection: {
        status: conn?.status || CHANNEL_CONNECTION_STATUS.DISCONNECTED,
        connected_at: conn?.connected_at || null,
        last_error: conn?.last_error || null,
        // Unmet prerequisite code plus tenant-facing text with the remedy.
        status_reason: conn?.status_reason || null,
        status_message: conn?.status_reason ? prerequisiteMessage(conn.status_reason, manifest.name) : null,
      },
      health: {
        consecutive_failures: consecutiveFailures,
        last_success_at: conn?.last_success_at || null,
      },
      listing_counts: listingCountsForPlatform,
      last_synced_at: lastSyncedAtByPlatform.get(manifest.key) || null,
      needs_attention_count: needsAttentionCount,
      health_status: healthStatus,
    };
  });
}

// entityId/status narrow to one listing's history (sync monitor).
async function getChannelLogs(tenantId, platform, { page = 1, limit = 20, entityId = null, status = null } = {}) {
  const skip = (page - 1) * limit;
  const query = { tenant_id: tenantId, platform };
  if (entityId) query.entity_id = entityId;
  if (status) query.status = status;
  const [items, total] = await Promise.all([
    ChannelSyncLog.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ChannelSyncLog.countDocuments(query),
  ]);

  return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
}

// seq: null so it applies; bypassDebounce since the jobId may be taken.
async function retryChannelLog(tenantId, platform, logId) {
  const log = await ChannelSyncLog.findOne({ _id: logId, tenant_id: tenantId, platform }).lean();
  if (!log) return null;
  if (!log.entity_id || log.entity_type !== "MarketplaceListing") {
    const err = new Error("This log entry has no associated listing to retry");
    err.status = 400;
    throw err;
  }

  await enqueueChannelJob(platform, "sync_listing", { listingId: log.entity_id.toString(), seq: null }, { bypassDebounce: true });
  return { requeued: true, listingId: log.entity_id.toString() };
}

module.exports = { listChannelsForTenant, getChannelLogs, retryChannelLog, checkStorefrontRequirement };
