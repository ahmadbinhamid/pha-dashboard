// utils/http/oauthError.js
// Recognises a refused refresh token and tags it for the reauth flow.

const { httpError } = require("./httpError");
const {
  CHANNEL_REAUTH_ERROR_CODE,
  CHANNEL_STATUS_REASON,
} = require("../../constants/channel.constants");

// RFC 6749 invalid_grant: refresh token revoked or expired, not a bad request.
function isInvalidGrant(body) {
  try {
    return JSON.parse(body)?.error === "invalid_grant";
  } catch {
    return false;
  }
}

// Keeps the upstream non-401 status so the breaker and HTTP layer ignore it.
function reauthRequiredError(message, status) {
  return httpError(message, status, {
    code: CHANNEL_REAUTH_ERROR_CODE,
    statusReason: CHANNEL_STATUS_REASON.REAUTHENTICATION_REQUIRED,
  });
}

module.exports = { isInvalidGrant, reauthRequiredError };
