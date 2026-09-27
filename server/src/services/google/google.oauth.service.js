// services/google/google.oauth.service.js
// Google OAuth 2.0 consent flow + token management, mirroring ebay.oauth.service.js's shape.
// Unlike eBay's in-memory token cache, Google's access token is persisted on ChannelConnection
// so it survives restarts and is shared across worker processes.

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { signJwt, verifyJwt } = require("../../utils/auth/jwt");
const { encrypt, decrypt, packCiphertext, unpackCiphertext } = require("../../utils/crypto/tokenCipher");
const ChannelConnection = require("../../models/ChannelConnection");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");

const PLATFORM = MARKETPLACE_PLATFORM.GOOGLE;

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// The one scope this integration needs: insert/delete product inputs, manage data sources.
const MERCHANT_SCOPE = "https://www.googleapis.com/auth/content";

const OAUTH_STATE_PURPOSE = "google_oauth";
const OAUTH_STATE_TTL = "10m";

// How far ahead of expiry a stored access token is treated as needing refresh.
const EXPIRY_BUFFER_MS = 60_000;

function assertConfigured() {
  if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI",
    );
  }
}

// Returns the consent URL. access_type offline + prompt consent are both required to get a
// refresh_token back, since Google only issues one on first consent (or forced reconsent).
// Consent happens before Merchant Center account selection — state carries only tenant_id +
// purpose; account selection moves to listAccessibleAccounts/completeConnection below.
function buildConsentUrl({ tenantId }) {
  assertConfigured();

  const state = signJwt(
    { tenant_id: String(tenantId), purpose: OAUTH_STATE_PURPOSE },
    { expiresIn: OAUTH_STATE_TTL },
  );

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: MERCHANT_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${AUTH_BASE}?${params.toString()}`;
}

// Verifies the round-tripped `state`; throws (never returns "no tenant") on any invalid token.
function resolveState(state) {
  if (!state) throw new Error("Missing OAuth state");
  const payload = verifyJwt(state);
  if (payload.purpose !== OAUTH_STATE_PURPOSE) throw new Error("Invalid OAuth state");
  return { tenantId: payload.tenant_id };
}

// Wraps a fetch failure into an Error carrying `.status` so the circuit breaker can classify it.
async function throwForResponse(res, action) {
  const text = await res.text();
  logger.error(`[google.oauth] ${action} failed`, { status: res.status, body: text });
  const err = new Error(`Google ${action} failed: ${res.status} ${text}`);
  err.status = res.status;
  throw err;
}

// One-time code exchange. Returns both tokens, unlike eBay's (which only returns a refresh_token),
// so the caller can persist a complete ChannelConnection without a second round trip.
async function exchangeCodeForTokens(code) {
  assertConfigured();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) await throwForResponse(res, "code exchange");

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error(
      "Google token response did not include a refresh_token — this can happen on a repeat consent without " +
        "prompt=consent; buildConsentUrl always sets it, so this indicates something else went wrong",
    );
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in || 3600 };
}

// In-flight refresh de-duplication, keyed by tenant id, so two racing jobs share one refresh
// instead of both hitting Google's endpoint. Only de-dupes within one process; cross-process
// races are still safe (Mongo writes are atomic) but not fully eliminated without Redis.
const _refreshInFlight = new Map();

async function refreshAccessToken(tenantId, refreshToken) {
  const key = String(tenantId);
  const existing = _refreshInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) await throwForResponse(res, "token refresh");

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    const { ciphertext, iv, tag } = encrypt(data.access_token);
    await ChannelConnection.updateOne(
      { tenant_id: tenantId, platform: PLATFORM },
      {
        $set: {
          access_token_ct: packCiphertext({ ciphertext, iv, tag }),
          token_expires_at: expiresAt,
          consecutive_failures: 0,
          last_success_at: new Date(),
          status: CHANNEL_CONNECTION_STATUS.CONNECTED,
          last_error: null,
        },
      },
    );

    return { accessToken: data.access_token, expiresAt };
  })();

  _refreshInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    _refreshInFlight.delete(key);
  }
}

// Returns a valid plaintext access token, refreshing and persisting proactively if needed.
// `connection` is the lean ChannelConnection doc with access_token_ct/refresh_token_ct selected.
async function getValidAccessToken(connection) {
  if (!connection) return null;

  const { ciphertext: rCiphertext, iv: rIv, tag: rTag } = unpackCiphertext(connection.refresh_token_ct);
  const refreshToken = decrypt({ ciphertext: rCiphertext, iv: rIv, tag: rTag });
  if (!refreshToken) return null;

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.access_token_ct && Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
    const { ciphertext, iv, tag } = unpackCiphertext(connection.access_token_ct);
    const cached = decrypt({ ciphertext, iv, tag });
    if (cached) return cached;
  }

  const { accessToken } = await refreshAccessToken(connection.tenant_id, refreshToken);
  return accessToken;
}

// Step 1 of 2, right after the OAuth redirect: exchanges the code and saves just the token
// under a PENDING connection row — nothing Merchant-Center-specific chosen yet.
async function savePendingConnection({ tenantId, code }) {
  const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code);

  const { ciphertext: aC, iv: aIv, tag: aTag } = encrypt(accessToken);
  const { ciphertext: rC, iv: rIv, tag: rTag } = encrypt(refreshToken);

  await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    {
      $set: {
        status: CHANNEL_CONNECTION_STATUS.PENDING,
        access_token_ct: packCiphertext({ ciphertext: aC, iv: aIv, tag: aTag }),
        refresh_token_ct: packCiphertext({ ciphertext: rC, iv: rIv, tag: rTag }),
        token_expires_at: new Date(Date.now() + expiresIn * 1000),
        last_error: null,
      },
      $setOnInsert: { tenant_id: tenantId, platform: PLATFORM },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  logger.info("[google.oauth] OAuth consent completed, awaiting account selection", { tenantId: String(tenantId) });
}

// Shared by listAccessibleAccounts and completeConnection: both need a valid access token for
// whatever connection this tenant has on file. Throws a named error if the OAuth step never ran.
async function loadTokenForTenant(tenantId) {
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM })
    .select("+access_token_ct +refresh_token_ct")
    .lean();
  if (!conn) {
    const err = new Error("No Google OAuth session found for this tenant — start the connect flow first.");
    err.status = 400;
    err.code = "NO_PENDING_CONNECTION";
    throw err;
  }
  return getValidAccessToken(conn);
}

// Lists the Merchant Center accounts the just-granted token can access, for the tenant to
// pick from. Thin pass-through to google.datasource.service.js#listAccounts.
async function listAccessibleAccounts(tenantId) {
  const token = await loadTokenForTenant(tenantId);
  const { listAccounts } = require("./google.datasource.service");
  return listAccounts(token);
}

// Step 2 of 2: the tenant picked a Merchant Center account — ensures the data source exists
// and upgrades the PENDING connection to CONNECTED, reusing the token savePendingConnection saved.
// `verifiedAccountIds`: pass the caller's fresh account ids to reject a mismatched merchantId early;
// omit (not empty array) for the manual-entry fallback where accounts.list wasn't usable.
async function completeConnection({ tenantId, merchantId, feedLabel, contentLanguage, targetCountry, verifiedAccountIds }) {
  if (verifiedAccountIds && !verifiedAccountIds.includes(String(merchantId))) {
    const err = new Error(`This Google account does not have access to Merchant Center account ${merchantId}.`);
    err.status = 400;
    err.code = "MERCHANT_NOT_ACCESSIBLE";
    throw err;
  }

  const accessToken = await loadTokenForTenant(tenantId);
  const { ensureDataSource } = require("./google.datasource.service");
  const dataSourceId = await ensureDataSource(accessToken, { merchantId, feedLabel, contentLanguage });

  const conn = await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    {
      $set: {
        status: CHANNEL_CONNECTION_STATUS.CONNECTED,
        connected_at: new Date(),
        last_error: null,
        consecutive_failures: 0,
        merchant_id: merchantId,
        data_source_id: dataSourceId,
        feed_label: feedLabel,
        content_language: contentLanguage,
        target_country: targetCountry,
      },
    },
    // strict: false, since these fields are Google-discriminator-only and a base-model update
    // would otherwise silently drop them. No upsert — a missing PENDING row should surface as null.
    { new: true, strict: false },
  );

  logger.info("[google.oauth] Tenant connected via OAuth", { tenantId: String(tenantId), merchantId, dataSourceId });
  return conn;
}

module.exports = {
  buildConsentUrl,
  resolveState,
  exchangeCodeForTokens,
  getValidAccessToken,
  savePendingConnection,
  listAccessibleAccounts,
  completeConnection,
  // Exported for tests (concurrent-refresh race coverage).
  refreshAccessToken,
};
