// services/google/google.oauth.service.js
// Google OAuth consent + tokens; access token persisted, unlike eBay's cache.

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { signJwt, verifyJwt } = require("../../utils/auth/jwt");
const { encrypt, decrypt, packCiphertext, unpackCiphertext } = require("../../utils/crypto/tokenCipher");
const ChannelConnection = require("../../models/ChannelConnection");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const { isInvalidGrant, reauthRequiredError } = require("../../utils/http/oauthError");

const PLATFORM = MARKETPLACE_PLATFORM.GOOGLE;

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Only scope needed: product inputs and data sources.
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

// offline + prompt=consent: Google only returns a refresh_token on (re)consent.
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

// Throws (never returns "no tenant") on any invalid state token.
function resolveState(state) {
  if (!state) throw new Error("Missing OAuth state");
  const payload = verifyJwt(state);
  if (payload.purpose !== OAUTH_STATE_PURPOSE) throw new Error("Invalid OAuth state");
  return { tenantId: payload.tenant_id };
}

// `.status` lets the breaker classify it; tagRevoked flags invalid_grant.
async function throwForResponse(res, action, { tagRevoked = false } = {}) {
  const text = await res.text();
  logger.error(`[google.oauth] ${action} failed`, { status: res.status, body: text });
  const message = `Google ${action} failed: ${res.status} ${text}`;
  if (tagRevoked && isInvalidGrant(text)) throw reauthRequiredError(message, res.status);
  const err = new Error(message);
  err.status = res.status;
  throw err;
}

// Returns both tokens (eBay's returns only a refresh_token).
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

// Per-process refresh de-dupe; cross-process races are safe, not eliminated.
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

    if (!res.ok) await throwForResponse(res, "token refresh", { tagRevoked: true });

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

/** Valid access token for a lean connection selected with both token fields. */
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

// Step 1 of 2: saves the token as PENDING; a new token also ends any reauth.
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
        status_reason: null,
      },
      $setOnInsert: { tenant_id: tenantId, platform: PLATFORM },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  logger.info("[google.oauth] OAuth consent completed, awaiting account selection", { tenantId: String(tenantId) });
}

// Token for the tenant's connection; throws a named error before OAuth ran.
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

// Merchant Center accounts the just-granted token can access.
async function listAccessibleAccounts(tenantId) {
  const token = await loadTokenForTenant(tenantId);
  const { listAccounts } = require("./google.datasource.service");
  return listAccounts(token);
}

// Step 2 of 2; omit verifiedAccountIds (not []) for the manual-entry fallback.
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
    // strict:false keeps discriminator fields; no upsert, a missing row is null.
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
