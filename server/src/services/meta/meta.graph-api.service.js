// services/meta/meta.graph-api.service.js
// Pure Graph HTTP client: token passed per call, appsecret_proof on every call.

const crypto = require("crypto");
const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { graphResponseError } = require("../../utils/http/graphError");

// Computed per call so a config change (or a test override) always applies.
function graphBaseUrl() {
  return `${config.meta.graphHost}/${config.meta.graphVersion}`;
}

function assertAppSecret() {
  if (!config.meta.appSecret) {
    throw new Error("Meta is not configured — set META_APP_ID, META_APP_SECRET and META_REDIRECT_URI");
  }
}

/** HMAC-SHA256 of the token keyed by the app secret, hex (Meta's spec). */
function appSecretProof(token) {
  assertAppSecret();
  return crypto.createHmac("sha256", config.meta.appSecret).update(token).digest("hex");
}

function authParams(token) {
  return { access_token: token, appsecret_proof: appSecretProof(token) };
}

// Values that aren't strings (e.g. batch `requests`) are sent as JSON.
function toSearchParams(params) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return out;
}

// Logs path and Meta's error body only; the URL carries the token.
async function throwForResponse(res, action, path) {
  const text = await res.text();
  const err = graphResponseError(action, res.status, text);
  logger.error(`[meta.graph] ${action} failed`, { path, status: res.status, metaCode: err.metaCode, metaSubcode: err.metaSubcode });
  throw err;
}

/** GET {graph}/{path}; resolves to the parsed JSON body. */
async function graphGet(token, path, params = {}, action = `GET ${path}`) {
  const query = toSearchParams({ ...params, ...authParams(token) });
  const res = await fetch(`${graphBaseUrl()}/${path}?${query.toString()}`, { method: "GET" });
  if (!res.ok) await throwForResponse(res, action, path);
  return res.json();
}

/** POST {graph}/{path} as a form body, so the token never sits in a URL. */
async function graphPost(token, path, params = {}, action = `POST ${path}`) {
  const body = toSearchParams({ ...params, ...authParams(token) });
  const res = await fetch(`${graphBaseUrl()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) await throwForResponse(res, action, path);
  return res.json();
}

module.exports = { graphBaseUrl, appSecretProof, graphGet, graphPost, throwForResponse };
