// utils/http/graphError.js
// Classifies Meta Graph errors by error.code, since most arrive as HTTP 400.

const { httpError } = require("./httpError");
const { reauthRequiredError } = require("./oauthError");
const {
  META_THROTTLE_CODES,
  META_TRANSIENT_CODES,
  META_TOKEN_CODE,
  META_PERMISSION_CODES,
} = require("../../constants/meta.constants");

// Synthetic statuses that circuitBreaker#isTransportOrAuthFailure reads.
const TRANSPORT_STATUS = 503;
const PERMISSION_STATUS = 403;

/** Graph's { error: {...} } body, or null when the body isn't one. */
function parseGraphError(text) {
  try {
    const error = JSON.parse(text)?.error;
    return error && typeof error === "object" ? error : null;
  } catch {
    return null;
  }
}

function isThrottle(code) {
  return META_THROTTLE_CODES.includes(code);
}

// NOTE: throttling maps to 503 so it retries and counts toward the breaker.
function statusFor(httpStatus, code) {
  if (isThrottle(code) || META_TRANSIENT_CODES.includes(code)) return TRANSPORT_STATUS;
  if (META_PERMISSION_CODES.includes(code)) return PERMISSION_STATUS;
  return httpStatus;
}

/** Error for a failed Graph response; never includes the request URL. */
function graphResponseError(action, httpStatus, text) {
  const graph = parseGraphError(text);
  const code = Number.isInteger(graph?.code) ? graph.code : null;
  const subcode = Number.isInteger(graph?.error_subcode) ? graph.error_subcode : null;
  const detail = graph?.message || String(text || "").slice(0, 500);
  const message = `Meta ${action} failed: ${httpStatus}${code != null ? ` (code ${code})` : ""} ${detail}`;
  const props = { metaCode: code, metaSubcode: subcode, upstreamStatus: httpStatus };
  // Reuses the Google/eBay reauth tag; keeps a non-401 status off the breaker.
  if (code === META_TOKEN_CODE) return Object.assign(reauthRequiredError(message, 400), props);
  return httpError(message, statusFor(httpStatus, code), {
    ...props,
    code: isThrottle(code) ? "META_RATE_LIMITED" : `META_GRAPH_${code ?? httpStatus}`,
  });
}

module.exports = { parseGraphError, graphResponseError, isThrottle };
