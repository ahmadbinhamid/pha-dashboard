// constants/tenant.constants.js

const TENANT_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

// BYOK — shared by every "tenant supplies their own credentials" integration
// (Stripe keys, SMTP credentials, ...): either they work (connected), haven't
// been entered yet, or failed our validation call (error). Mirrors
// EBAY_CONNECTION_STATUS in constants/ebay.constants.js, which stays separate
// since eBay's OAuth flow has extra states (token_expired/revoked) these
// simpler key/password integrations don't.
const CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  ERROR: "error",
});

module.exports = { TENANT_STATUS, CONNECTION_STATUS };
