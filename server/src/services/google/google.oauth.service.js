// services/google/google.oauth.service.js
//
// Google OAuth 2.0 consent flow + token management for the Merchant API —
// mirrors services/ebay/ebay.oauth.service.js's shape (buildConsentUrl,
// resolveState, code exchange), plus access-token refresh/caching, which
// eBay keeps entirely in-memory (see ebay.api.service.js#getAccessToken) —
// Google's access token is instead PERSISTED on ChannelConnection
// (access_token_ct/token_expires_at) so it survives a process restart and
// every worker process shares one source of truth, refreshed proactively
// rather than lazily on every call.
//
// Unlike eBay's OAuth ("RuName" indirection — the redirect_uri sent is an
// opaque identifier, not a literal URL), Google's redirect_uri really is
// the literal callback URL registered in the Google Cloud Console.

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

// Content API for Shopping / Merchant API scope — the one scope this
// integration needs (insert/delete product inputs, manage data sources).
const MERCHANT_SCOPE = "https://www.googleapis.com/auth/content";

const OAUTH_STATE_PURPOSE = "google_oauth";
const OAUTH_STATE_TTL = "10m";

// How far ahead of actual expiry a cached/stored access token is treated as
// "needs refresh" — mirrors the 30s buffer ebay.api.service.js#getAccessToken
// uses for its own in-memory cache.
const EXPIRY_BUFFER_MS = 60_000;

function assertConfigured() {
  if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI",
    );
  }
}

// Returns the URL the frontend should navigate the browser to. access_type
// offline + prompt consent are both required to get a refresh_token back at
// all — Google only issues one on a user's FIRST consent (or when force-
// reconsented like this), silently omitting it on a repeat authorization
// otherwise, which would leave a reconnect attempt with no way to get a new
// refresh_token if the old one had been revoked.
// merchantId/feedLabel/contentLanguage/targetCountry: Google's OAuth
// consent has no equivalent of eBay's "one application, tenant just
// authorizes it" simplicity — a Merchant Center account id and feed
// settings are tenant-chosen inputs, not something OAuth hands back. They
// travel inside the signed state (same mechanism eBay uses for its own
// `sandbox` flag) so the callback has them without a second round trip or
// a separate "finish setting up" step after redirect.
function buildConsentUrl({ tenantId, merchantId, feedLabel, contentLanguage, targetCountry }) {
  assertConfigured();
  if (!merchantId || !feedLabel || !contentLanguage || !targetCountry) {
    throw new Error("merchantId, feedLabel, contentLanguage and targetCountry are all required to connect Google Shopping");
  }

  const state = signJwt(
    { tenant_id: String(tenantId), merchant_id: merchantId, feed_label: feedLabel, content_language: contentLanguage, target_country: targetCountry, purpose: OAUTH_STATE_PURPOSE },
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

// Verifies the round-tripped `state` and returns the tenant it belongs to.
// Throws on a missing/expired/tampered/wrong-purpose token — callers should
// treat that as a rejected callback, never as "no tenant."
function resolveState(state) {
  if (!state) throw new Error("Missing OAuth state");
  const payload = verifyJwt(state);
  if (payload.purpose !== OAUTH_STATE_PURPOSE) throw new Error("Invalid OAuth state");
  return {
    tenantId: payload.tenant_id,
    merchantId: payload.merchant_id,
    feedLabel: payload.feed_label,
    contentLanguage: payload.content_language,
    targetCountry: payload.target_country,
  };
}

// Wraps a fetch Response's failure into an Error carrying `.status` so the
// circuit breaker (services/marketplace/circuitBreaker.js) can classify it —
// >=500/401/403 count toward the breaker, everything else (a malformed
// request, an expired/revoked code) doesn't. Same convention as eBay's
// EbayApiError, without introducing a parallel error class hierarchy for one
// field.
async function throwForResponse(res, action) {
  const text = await res.text();
  logger.error(`[google.oauth] ${action} failed`, { status: res.status, body: text });
  const err = new Error(`Google ${action} failed: ${res.status} ${text}`);
  err.status = res.status;
  throw err;
}

// One-time authorization-code exchange. Returns BOTH tokens — unlike eBay's
// exchange (which only ever returns a refresh_token, since eBay mints access
// tokens fresh on every call), Google's code exchange also returns a usable
// access_token + expires_in immediately, so the caller can persist a
// complete, already-valid ChannelConnection without a second round trip.
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

// In-flight refresh de-duplication, keyed by tenant id — two jobs racing to
// refresh the SAME tenant's token (e.g. two sync_batch/sync_listing jobs
// picked up around the same time) await the SAME underlying refresh instead
// of both hitting Google's token endpoint and both writing back a token
// (harmless individually — Google allows concurrent refreshes of one
// refresh_token — but wasteful, and the failure mode this exists to avoid:
// two racing writes with no ordering guarantee "clobbering" each other with
// whichever finishes last). NOTE: this de-dupes within ONE process only; two
// separate worker processes could still both refresh around the same
// moment. That's still safe (Mongo's own single-document writes are atomic,
// and a stale-but-still-valid access token from the "losing" refresh is
// simply not reused past its own real expiry), just not fully eliminated —
// a cross-process lock would need Redis, which this run doesn't add.
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

// Returns a valid (not near-expiry) plaintext access token for this
// connection, refreshing and persisting proactively if needed. `connection`
// is the lean ChannelConnection doc (with access_token_ct/refresh_token_ct
// selected) — same shape google.merchant.api.service.js's callers already
// have from loadSettings.
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

// Finishes the connect flow after a successful OAuth callback: exchanges
// the code, ensures the tenant's Merchant API data source exists (Task 2 —
// "a data source must exist before any product push... during connect, not
// lazily on first sync"), and persists the resulting ChannelConnection.
// Kept here (the service layer), not in google.controller.js, per this
// codebase's DB-access-belongs-in-a-service convention — the controller
// just calls this one function and handles the HTTP redirect.
async function completeConnection({ tenantId, code, merchantId, feedLabel, contentLanguage, targetCountry }) {
  const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code);
  const { ensureDataSource } = require("./google.datasource.service");
  const dataSourceId = await ensureDataSource(accessToken, { merchantId, feedLabel, contentLanguage });

  const { ciphertext: aC, iv: aIv, tag: aTag } = encrypt(accessToken);
  const { ciphertext: rC, iv: rIv, tag: rTag } = encrypt(refreshToken);

  const conn = await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    {
      $set: {
        status: CHANNEL_CONNECTION_STATUS.CONNECTED,
        access_token_ct: packCiphertext({ ciphertext: aC, iv: aIv, tag: aTag }),
        refresh_token_ct: packCiphertext({ ciphertext: rC, iv: rIv, tag: rTag }),
        token_expires_at: new Date(Date.now() + expiresIn * 1000),
        connected_at: new Date(),
        last_error: null,
        consecutive_failures: 0,
        merchant_id: merchantId,
        data_source_id: dataSourceId,
        feed_label: feedLabel,
        content_language: contentLanguage,
        target_country: targetCountry,
      },
      $setOnInsert: { tenant_id: tenantId, platform: PLATFORM },
    },
    // merchant_id/data_source_id/feed_label/content_language/target_country
    // are Google-discriminator-only fields (declared on the google schema
    // in models/ChannelConnection.js, not the base schema) — a base-model
    // update casts $set against the base schema only and silently drops
    // anything it doesn't recognize under Mongoose's default strict mode.
    // Same fix, same reasoning as ebay.adapter.js#updateSyncBaseline's own
    // strict: false — kept consistent with that established pattern rather
    // than switching to ChannelConnection.discriminators[...].
    { upsert: true, new: true, setDefaultsOnInsert: true, strict: false },
  );

  logger.info("[google.oauth] Tenant connected via OAuth", { tenantId: String(tenantId), merchantId, dataSourceId });
  return conn;
}

module.exports = {
  buildConsentUrl,
  resolveState,
  exchangeCodeForTokens,
  getValidAccessToken,
  completeConnection,
  // Exported for tests (concurrent-refresh race coverage).
  refreshAccessToken,
};
