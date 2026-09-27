// services/marketplace/channelPrerequisite.service.js
// Manifest-declared channel prerequisites, re-checked on every sync.

const ChannelConnection = require("../../models/ChannelConnection");
const {
  CHANNEL_CONNECTION_STATUS,
  CHANNEL_STATUS_REASON,
  CHANNEL_PREREQUISITE_ERROR_CODE,
} = require("../../constants/channel.constants");

// Only channel-level needs belong here; per-item data problems never do.
const PREREQUISITES = [
  {
    reason: CHANNEL_STATUS_REASON.STOREFRONT_REQUIRED,
    declaredBy: (manifest) => manifest?.requiresStorefront === true,
    // Lazy: domain.service is heavier and unrelated to most channel paths.
    isMet: (tenantId) => require("../domain.service").hasVerifiedDefaultDomain(tenantId),
    message: (name) =>
      `${name} needs a verified default storefront domain. Verify a domain under Settings > Domains ` +
      "and set it as default; syncing resumes on its own.",
  },
];

const byReason = new Map(PREREQUISITES.map((p) => [p.reason, p]));

/** Tenant-facing text (with remedy) for a CHANNEL_STATUS_REASON. */
function prerequisiteMessage(reason, channelName) {
  return byReason.get(reason)?.message(channelName) ?? null;
}

/** First declared prerequisite this tenant doesn't meet, or null. */
async function findUnmetPrerequisite(tenantId, manifest) {
  for (const prerequisite of PREREQUISITES) {
    if (!prerequisite.declaredBy(manifest)) continue;
    if (!(await prerequisite.isMet(tenantId))) {
      return { reason: prerequisite.reason, message: prerequisite.message(manifest?.name ?? "This channel") };
    }
  }
  return null;
}

// Only a live connection is flagged; other statuses keep their state.
async function markPrerequisiteUnmet(tenantId, platform, { reason, message }) {
  await ChannelConnection.updateOne(
    {
      tenant_id: tenantId,
      platform,
      status: { $in: [CHANNEL_CONNECTION_STATUS.CONNECTED, CHANNEL_CONNECTION_STATUS.ERROR] },
    },
    { $set: { status: CHANNEL_CONNECTION_STATUS.ERROR, status_reason: reason, last_error: message } },
  );
}

async function clearPrerequisiteState(tenantId, platform) {
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform, status: CHANNEL_CONNECTION_STATUS.ERROR, status_reason: { $ne: null } },
    { $set: { status: CHANNEL_CONNECTION_STATUS.CONNECTED, status_reason: null, last_error: null } },
  );
}

/** Sync pre-flight: flags an unmet prerequisite, or clears it once met. */
async function ensurePrerequisites({ tenantId, platform, manifest, connection }) {
  const unmet = await findUnmetPrerequisite(tenantId, manifest);
  if (unmet) {
    await markPrerequisiteUnmet(tenantId, platform, unmet);
    return unmet;
  }
  if (connection?.status_reason) await clearPrerequisiteState(tenantId, platform);
  return null;
}

function isPrerequisiteError(err) {
  return err?.code === CHANNEL_PREREQUISITE_ERROR_CODE && byReason.has(err.statusReason);
}

// Race backstop (domain removed mid-sync): the resolver's tagged error.
async function flagIfPrerequisiteError(tenantId, platform, manifest, err) {
  if (!isPrerequisiteError(err)) return false;
  const message = prerequisiteMessage(err.statusReason, manifest?.name ?? platform);
  await markPrerequisiteUnmet(tenantId, platform, { reason: err.statusReason, message });
  return true;
}

/** Clears a tenant's flagged connections whose prerequisite is now met. */
async function reconcileTenantPrerequisites(tenantId) {
  const registry = require("./registry");
  const flagged = await ChannelConnection.find({
    tenant_id: tenantId,
    status: CHANNEL_CONNECTION_STATUS.ERROR,
    status_reason: { $ne: null },
  })
    .select("platform")
    .lean();
  const cleared = [];
  for (const { platform } of flagged) {
    if (!registry.has(platform)) continue;
    const unmet = await findUnmetPrerequisite(tenantId, registry.get(platform).manifest);
    if (unmet) continue;
    await clearPrerequisiteState(tenantId, platform);
    cleared.push(platform);
  }
  return cleared;
}

module.exports = {
  findUnmetPrerequisite,
  ensurePrerequisites,
  flagIfPrerequisiteError,
  isPrerequisiteError,
  prerequisiteMessage,
  reconcileTenantPrerequisites,
};
