// services/meta/meta.oauth.service.js
// Facebook Login for Business: consent URL, code exchange, token storage.

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { signJwt, verifyJwt } = require("../../utils/auth/jwt");
const { encrypt, decrypt, packCiphertext, unpackCiphertext } = require("../../utils/crypto/tokenCipher");
const { httpError } = require("../../utils/http/httpError");
const { reauthRequiredError } = require("../../utils/http/oauthError");
const ChannelConnection = require("../../models/ChannelConnection");
const { graphBaseUrl, throwForResponse } = require("./meta.graph-api.service");
const metaCatalogApi = require("./meta.catalog-api.service");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const {
  META_OAUTH_STATE_PURPOSE,
  META_OAUTH_STATE_TTL,
  META_TOKEN_RENEW_WARNING_DAYS,
} = require("../../constants/meta.constants");

const PLATFORM = MARKETPLACE_PLATFORM.META;
const DAY_MS = 24 * 60 * 60 * 1000;

function assertConfigured() {
  const { appId, appSecret, redirectUri, loginConfigId } = config.meta;
  if (!appId || !appSecret || !redirectUri || !loginConfigId) {
    throw new Error("Meta is not configured — set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI and META_LOGIN_CONFIG_ID");
  }
}

// config_id replaces scope; code flow is required for a system-user token.
function buildConsentUrl({ tenantId }) {
  assertConfigured();
  const state = signJwt({ tenant_id: String(tenantId), purpose: META_OAUTH_STATE_PURPOSE }, { expiresIn: META_OAUTH_STATE_TTL });
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: config.meta.redirectUri,
    config_id: config.meta.loginConfigId,
    response_type: "code",
    override_default_response_type: "true",
    state,
  });
  return `${config.meta.dialogHost}/${config.meta.graphVersion}/dialog/oauth?${params.toString()}`;
}

// Throws on any invalid state token.
function resolveState(state) {
  if (!state) throw new Error("Missing OAuth state");
  const payload = verifyJwt(state);
  if (payload.purpose !== META_OAUTH_STATE_PURPOSE) throw new Error("Invalid OAuth state");
  return { tenantId: payload.tenant_id };
}

// System-user tokens don't expire by default; expires_in only when dated.
async function exchangeCodeForToken(code) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    redirect_uri: config.meta.redirectUri,
    code,
  });
  const res = await fetch(`${graphBaseUrl()}/oauth/access_token?${params.toString()}`, { method: "GET" });
  if (!res.ok) await throwForResponse(res, "code exchange", "oauth/access_token");
  const data = await res.json();
  if (!data.access_token) throw new Error("Meta code exchange returned no access_token");
  const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : null;
  return { accessToken: data.access_token, expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null };
}

/** True when a dated token is inside the reconnect-warning window. */
function isTokenNearExpiry(connection, now = Date.now()) {
  if (!connection?.token_expires_at) return false;
  return new Date(connection.token_expires_at).getTime() - now < META_TOKEN_RENEW_WARNING_DAYS * DAY_MS;
}

/** Decrypted token; an expired dated token flags reauth instead of a call. */
function getAccessToken(connection) {
  if (!connection?.access_token_ct) return null;
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
    throw reauthRequiredError("Meta access token has expired", 400);
  }
  if (isTokenNearExpiry(connection)) {
    logger.warn("[meta.oauth] access token expires soon — tenant should reconnect Meta", { tenantId: String(connection.tenant_id) });
  }
  return decrypt(unpackCiphertext(connection.access_token_ct));
}

// Step 1 of 2: token saved as PENDING; a new token also clears any reauth.
async function savePendingConnection({ tenantId, code }) {
  const { accessToken, expiresAt } = await exchangeCodeForToken(code);
  await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    {
      $set: {
        status: CHANNEL_CONNECTION_STATUS.PENDING,
        access_token_ct: packCiphertext(encrypt(accessToken)),
        token_expires_at: expiresAt,
        last_error: null,
        status_reason: null,
      },
      $setOnInsert: { tenant_id: tenantId, platform: PLATFORM },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  logger.info("[meta.oauth] consent completed, awaiting catalog selection", { tenantId: String(tenantId) });
}

async function loadTokenForTenant(tenantId) {
  const conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM }).select("+access_token_ct").lean();
  const token = conn ? getAccessToken(conn) : null;
  if (!token) {
    throw httpError("No Meta sign-in found for this tenant — start the connect flow first.", 400, { code: "NO_PENDING_CONNECTION" });
  }
  return token;
}

/** Businesses the token reaches, each with its catalogs. */
async function listBusinessCatalogs(tenantId) {
  const token = await loadTokenForTenant(tenantId);
  const businesses = await metaCatalogApi.listBusinesses(token);
  return Promise.all(businesses.map(async (b) => ({ ...b, catalogs: await metaCatalogApi.listCatalogs(token, b.id) })));
}

// Step 2 of 2: the catalog must be one this token can actually reach.
async function completeConnection({ tenantId, businessId, catalogId }) {
  const businesses = await listBusinessCatalogs(tenantId);
  const business = businesses.find((b) => b.id === String(businessId));
  const catalog = business?.catalogs.find((c) => c.id === String(catalogId));
  if (!catalog) {
    throw httpError(`This Meta sign-in can't reach catalog ${catalogId} in business ${businessId}.`, 400, {
      code: "CATALOG_NOT_ACCESSIBLE",
    });
  }
  const conn = await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    {
      $set: {
        status: CHANNEL_CONNECTION_STATUS.CONNECTED,
        connected_at: new Date(),
        last_error: null,
        consecutive_failures: 0,
        external_account_id: business.id,
        business_id: business.id,
        business_name: business.name,
        catalog_id: catalog.id,
        catalog_name: catalog.name,
      },
    },
    // strict:false keeps discriminator fields; no upsert, a missing row is null.
    { new: true, strict: false },
  );
  logger.info("[meta.oauth] tenant connected", { tenantId: String(tenantId), businessId: business.id, catalogId: catalog.id });
  return conn;
}

module.exports = {
  buildConsentUrl,
  resolveState,
  exchangeCodeForToken,
  getAccessToken,
  isTokenNearExpiry,
  savePendingConnection,
  listBusinessCatalogs,
  completeConnection,
};
