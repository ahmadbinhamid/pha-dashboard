// constants/tenant.constants.js

const TENANT_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

// BYOK: shared by every "tenant supplies their own credentials" integration. Mirrors
// EBAY_CONNECTION_STATUS, which stays separate since eBay's OAuth flow has extra states.
const CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  ERROR: "error",
});

// Which host a tenant's payment/order links go out under: the shared page or a "<slug>.<domain>"
// subdomain. Both resolve to the same dashboard SPA/API — only the URL bar/email text changes.
const PAYMENT_DOMAIN_MODE = Object.freeze({
  DEFAULT: "default",
  VENDOR_SLUG: "vendor_slug",
});

module.exports = { TENANT_STATUS, CONNECTION_STATUS, PAYMENT_DOMAIN_MODE };
