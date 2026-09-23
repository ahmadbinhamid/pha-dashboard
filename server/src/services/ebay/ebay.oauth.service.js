// services/ebay/ebay.oauth.service.js
// eBay OAuth 2.0 consent flow: tenant authorizes on eBay's screen, we exchange the returned code for a refresh_token.
// `state` carries the tenant/sandbox flag and is signed (not just base64'd) so it can't be forged to another tenant.

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { signJwt, verifyJwt } = require("../../utils/auth/jwt");
const { EBAY_SCOPES } = require("../../constants/ebay.constants");
const ebayApiService = require("./ebay.api.service");

const OAUTH_STATE_PURPOSE = "ebay_oauth";
const OAUTH_STATE_TTL = "10m";

const CONSENT_SCOPES = [
  EBAY_SCOPES.SELL_INVENTORY,
  EBAY_SCOPES.SELL_ACCOUNT,
  EBAY_SCOPES.SELL_FULFILLMENT,
  EBAY_SCOPES.NOTIFICATION_SUBSCRIPTION,
].join(" ");

function authorizeBaseFor(sandbox) {
  return sandbox ? "https://auth.sandbox.ebay.com/oauth2/authorize" : "https://auth.ebay.com/oauth2/authorize";
}

function assertConfigured() {
  if (!config.ebay.clientId || !config.ebay.clientSecret || !config.ebay.redirectUri) {
    throw new Error(
      "eBay OAuth is not configured — set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_REDIRECT_URI",
    );
  }
}

// Returns the consent URL to navigate to; `sandbox` travels in the signed state for the callback.
function buildConsentUrl({ tenantId, sandbox }) {
  assertConfigured();

  const state = signJwt({ tenant_id: String(tenantId), sandbox: !!sandbox, purpose: OAUTH_STATE_PURPOSE }, { expiresIn: OAUTH_STATE_TTL });

  const params = new URLSearchParams({
    client_id: config.ebay.clientId,
    redirect_uri: config.ebay.redirectUri,
    response_type: "code",
    scope: CONSENT_SCOPES,
    state,
  });

  return `${authorizeBaseFor(sandbox)}?${params.toString()}`;
}

// Verifies the round-tripped `state`; throws (never returns "no tenant") on any invalid token.
function resolveState(state) {
  if (!state) throw new Error("Missing OAuth state");
  const payload = verifyJwt(state);
  if (payload.purpose !== OAUTH_STATE_PURPOSE) throw new Error("Invalid OAuth state");
  return { tenantId: payload.tenant_id, sandbox: !!payload.sandbox };
}

// One-time authorization-code exchange, distinct from the refresh_token grant used on later calls.
async function exchangeCodeForRefreshToken(code, sandbox) {
  assertConfigured();

  const credentials = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.ebay.redirectUri,
  });

  const res = await fetch(ebayApiService.tokenEndpointFor(sandbox), {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("[ebay.oauth] Code exchange failed", { status: res.status, body: text });
    throw new Error(`eBay code exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.refresh_token) throw new Error("eBay token response did not include a refresh_token");
  return data.refresh_token;
}

module.exports = { buildConsentUrl, resolveState, exchangeCodeForRefreshToken };
