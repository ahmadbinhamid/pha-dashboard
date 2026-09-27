// services/marketplace/connectionDiagnosis.service.js
// Read-only connection health snapshot; never writes or loads token values.

const ChannelConnection = require("../../models/ChannelConnection");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const circuitBreaker = require("./circuitBreaker");
const registry = require("./registry");
const { findUnmetPrerequisite } = require("./channelPrerequisite.service");
const config = require("../../config");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

const NO_CODE = "(no code)";

// Presence checked in-query so token ciphertext never leaves the DB.
async function tokenState(connectionId, tokenExpiresAt, now) {
  const present = (field) => ChannelConnection.exists({ _id: connectionId, [field]: { $type: "string", $ne: "" } });
  const [refresh, access] = await Promise.all([present("refresh_token_ct"), present("access_token_ct")]);
  return {
    refreshTokenPresent: !!refresh,
    accessTokenPresent: !!access,
    tokenExpiresAt: tokenExpiresAt ?? null,
    tokenExpired: tokenExpiresAt ? tokenExpiresAt.getTime() < now.getTime() : null,
  };
}

// Rows keep message/code/status: the shape the thrown error had.
function recordedError(log) {
  return Object.assign(new Error(log.error_message ?? ""), { code: log.error_code ?? undefined, status: log.error_status ?? undefined });
}

async function failureStats(tenantId, platform, recentLimit) {
  const match = { tenant_id: tenantId, platform, status: CHANNEL_SYNC_LOG_STATUS.FAILURE };
  const [byCode, recent, lastSuccessLog] = await Promise.all([
    ChannelSyncLog.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ["$error_code", NO_CODE] }, count: { $sum: 1 }, latest: { $max: "$created_at" } } },
      { $sort: { count: -1 } },
    ]),
    ChannelSyncLog.find(match).sort({ created_at: -1 }).limit(recentLimit).lean(),
    ChannelSyncLog.findOne({ tenant_id: tenantId, platform, status: CHANNEL_SYNC_LOG_STATUS.SUCCESS })
      .sort({ created_at: -1 }).select("created_at").lean(),
  ]);
  return {
    total: byCode.reduce((sum, row) => sum + row.count, 0),
    byCode: byCode.map((row) => ({ code: row._id, count: row.count, latest: row.latest })),
    recent: recent.map((log) => ({
      at: log.created_at, jobType: log.job_type, attempt: log.attempt, code: log.error_code,
      status: log.error_status ?? null, entityId: log.entity_id ? String(log.entity_id) : null, message: log.error_message,
      // The recorded shape re-run through today's classifier.
      countsTowardBreaker: circuitBreaker.isTransportOrAuthFailure(recordedError(log)),
    })),
    lastSuccessLogAt: lastSuccessLog?.created_at ?? null,
  };
}

async function listingCounts(tenantId, platform) {
  const rows = await MarketplaceListing.aggregate([
    // aggregate() bypasses the soft-delete hook, so filter deleted rows here.
    { $match: { tenant_id: tenantId, platform, deleted_at: null } },
    { $group: { _id: "$sync_status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return Object.fromEntries(rows.map((row) => [row._id ?? "(unset)", row.count]));
}

/** Everything the diagnostic script reports; `tenantId` must be an ObjectId. */
async function diagnoseChannelConnection(tenantId, platform, { recentLimit = 5, now = new Date() } = {}) {
  const connection = await ChannelConnection.findOne({ tenant_id: tenantId, platform })
    .select("status status_reason consecutive_failures last_error last_success_at disabled_at connected_at token_expires_at external_account_id")
    .lean();
  const manifest = registry.has(platform) ? registry.get(platform).manifest : null;
  const [breakerOpen, tokens, failures, listings, prerequisite] = await Promise.all([
    circuitBreaker.isOpen(tenantId, platform),
    connection ? tokenState(connection._id, connection.token_expires_at, now) : null,
    failureStats(tenantId, platform, recentLimit),
    listingCounts(tenantId, platform),
    manifest ? findUnmetPrerequisite(tenantId, manifest) : null,
  ]);

  const diagnosis = {
    tenantId: String(tenantId),
    platform,
    connection: connection && {
      status: connection.status,
      statusReason: connection.status_reason ?? null,
      consecutiveFailures: connection.consecutive_failures,
      breakerThreshold: config.channels.circuitBreakerThreshold,
      lastError: connection.last_error,
      lastSuccessAt: connection.last_success_at,
      disabledAt: connection.disabled_at,
      connectedAt: connection.connected_at,
      externalAccountId: connection.external_account_id,
    },
    breakerOpen,
    prerequisite,
    tokens,
    failures,
    listings,
    syncLogTtlDays: config.channels.syncLogTtlDays,
  };
  return { ...diagnosis, summary: summarizeDiagnosis(diagnosis) };
}

const AUTH_PATTERN = /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid_grant|invalid[_ ]token|token (has been )?(expired|revoked)|permission/i;
const STOREFRONT_PATTERN = /no verified default domain|storefront domain/i;
const TRANSPORT_PATTERN = /\b5\d\d\b|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|timed? ?out|network/i;

function classify(text) {
  if (!text) return null;
  if (STOREFRONT_PATTERN.test(text)) return "storefront";
  if (AUTH_PATTERN.test(text)) return "auth";
  if (TRANSPORT_PATTERN.test(text)) return "transport";
  return "other";
}

// Plain-English "most likely cause", strongest signal first.
function summarizeDiagnosis(d) {
  const lines = [];
  if (!d.connection) {
    lines.push(`No live ${d.platform} ChannelConnection exists for this tenant: the channel isn't connected.`);
    return lines.join(" ");
  }
  const { connection: c, tokens: t, failures: f } = d;
  const kind = d.prerequisite ? "prerequisite" : (classify(c.lastError) ?? classify(f.recent[0]?.message));
  const latest = f.recent[0];

  if (c.disabledAt) lines.push(`Sync was paused on ${c.disabledAt.toISOString()} (disabled_at is set).`);
  if (d.breakerOpen) {
    lines.push(
      `The circuit breaker is OPEN (status=${c.status}, ${c.consecutiveFailures} counted failures, threshold ${c.breakerThreshold}), so every sync for this tenant is being skipped.`,
    );
  }
  if (!t.refreshTokenPresent) {
    lines.push("There is no stored refresh token, so access can't be renewed: the tenant must reconnect.");
  } else if (kind === "prerequisite" || kind === "storefront") {
    lines.push(
      `The cause is an unmet channel prerequisite (${d.prerequisite?.reason ?? "storefront_required"}), a configuration problem, not credentials or network. ` +
        (d.prerequisite?.message ?? "Verify a domain under Settings > Domains."),
    );
    if (latest) {
      lines.push(
        latest.countsTowardBreaker
          ? "Under the current breaker rule the latest recorded error still counts as a transport/auth failure."
          : "Under the current breaker rule the latest recorded error does NOT count toward the breaker (no network code, no 5xx/401/403).",
      );
    }
    if (d.breakerOpen) {
      lines.push(
        "The breaker tripped under the previous rule, which counted status-less errors as transport failures; it stays open until resumed. " +
          "Once resumed, the next sync flags the connection as needing attention (status=error, storefront_required) instead of failing per listing.",
      );
    }
    if (c.statusReason) lines.push(`The connection is already flagged: status=${c.status}, status_reason=${c.statusReason}.`);
  } else if (kind === "auth") {
    lines.push(
      "The failures are authentication/authorisation errors while a refresh token is stored: most likely the refresh token was revoked or expired, or the Google account lost access to the Merchant Center account. A reconnect (OAuth) is the probable fix.",
    );
  } else if (kind === "transport") {
    lines.push("The failures look like network/5xx errors from the platform: likely an outage or connectivity problem rather than bad credentials.");
  } else if (kind === "other") {
    lines.push(`The last recorded error isn't an auth or network error; read it directly: "${c.lastError ?? f.recent[0]?.message}".`);
  }
  if (t.refreshTokenPresent && t.tokenExpired) {
    lines.push("The access token has expired; that alone is normal (it refreshes on use) unless the refresh itself is failing.");
  }
  if (!d.breakerOpen && !c.disabledAt && !kind) {
    lines.push(
      (d.listings.error ?? 0) > 0
        ? "The connection looks healthy; listing errors are per-item data problems (see each listing's sync_error)."
        : "No problem found: the connection is healthy and no failures are logged.",
    );
  }
  if (f.total === 0 && (d.breakerOpen || c.lastError)) {
    lines.push(`No failure rows remain in the sync log (rows expire after ${d.syncLogTtlDays} days), so the evidence is last_error only.`);
  }
  return lines.join(" ");
}

module.exports = { diagnoseChannelConnection, summarizeDiagnosis };
