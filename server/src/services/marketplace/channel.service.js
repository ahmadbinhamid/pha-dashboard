// services/marketplace/channel.service.js
// DB-facing logic behind GET /api/v1/channels* (see controllers/channel.controller.js for the HTTP layer).

const registry = require("./registry");
const ChannelConnection = require("../../models/ChannelConnection");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { enqueueChannelJob } = require("../../queues/channel.queue");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const { LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");

function storefrontUnavailableReason(manifestName) {
  return `${manifestName} requires a verified storefront domain — connect and verify one under Settings > Domains before connecting ${manifestName}.`;
}

// Generic, platform-agnostic check driven by the adapter's own manifest.requiresStorefront flag —
// a future adapter needs zero new code here or at its call sites.
async function checkStorefrontRequirement(tenantId, platform) {
  const adapter = registry.get(platform);
  if (!adapter.manifest?.requiresStorefront) return { ok: true };

  const domainService = require("../domain.service");
  const hasDomain = await domainService.hasVerifiedDefaultDomain(tenantId);
  if (hasDomain) return { ok: true };

  return { ok: false, reason: storefrontUnavailableReason(adapter.manifest.name) };
}

// Every registered adapter's manifest merged with this tenant's connection status/health/counts —
// includes not-yet-connected platforms so the frontend can offer "Connect".
async function listChannelsForTenant(tenantId) {
  const manifests = registry.list();

  // Resolved once for the tenant, not per-manifest, and only if some registered platform needs it.
  const anyRequiresStorefront = manifests.some((m) => m.requiresStorefront);
  const [connections, listingCounts, hasVerifiedDomain] = await Promise.all([
    ChannelConnection.find({ tenant_id: tenantId }).lean(),
    // Max lastSyncedAt across every sync_status bucket (not just "synced"), so an errored channel still shows a real time.
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

    // A channel missing its storefront requirement is marked unavailable with a human-readable reason.
    const storefrontOk = !manifest.requiresStorefront || hasVerifiedDomain;
    const listingCountsForPlatform = countsByPlatform.get(manifest.key) || {};
    const consecutiveFailures = conn?.consecutive_failures || 0;

    // The two LISTING_SYNC_STATUS values meaning something's actually wrong with this listing.
    const needsAttentionCount =
      (listingCountsForPlatform[LISTING_SYNC_STATUS.ERROR] || 0) +
      (listingCountsForPlatform[LISTING_SYNC_STATUS.PRICE_LOCKED] || 0);

    // Computed server-side (not left to the frontend), folding in both per-listing and
    // connection-level trouble. Mirrors dashboard.service.js#getPlatformChannelHealth's logic.
    const healthStatus =
      needsAttentionCount > 0 ||
      conn?.status === CHANNEL_CONNECTION_STATUS.DEGRADED ||
      consecutiveFailures > 0
        ? "needs_attention"
        : "healthy";

    return {
      ...manifest,
      capabilities: adapter.capabilities,
      available: storefrontOk,
      unavailable_reason: storefrontOk ? null : storefrontUnavailableReason(manifest.name),
      connection: {
        status: conn?.status || CHANNEL_CONNECTION_STATUS.DISCONNECTED,
        connected_at: conn?.connected_at || null,
        last_error: conn?.last_error || null,
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

async function getChannelLogs(tenantId, platform, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ChannelSyncLog.find({ tenant_id: tenantId, platform }).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ChannelSyncLog.countDocuments({ tenant_id: tenantId, platform }),
  ]);

  return { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
}

// Re-enqueues the listing behind a failed log row — a fresh sync_listing job with seq: null so
// it always applies. bypassDebounce: true since the debounced jobId may already be occupied.
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
