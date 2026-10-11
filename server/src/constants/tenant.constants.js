// constants/tenant.constants.js

const TENANT_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

// BYOK integrations; eBay keeps its own enum for its extra OAuth states.
const CONNECTION_STATUS = Object.freeze({
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  ERROR: "error",
});

// Host for payment/order links: shared page or "<slug>.<domain>"; same app.
const PAYMENT_DOMAIN_MODE = Object.freeze({
  DEFAULT: "default",
  VENDOR_SLUG: "vendor_slug",
});

// NOTE: Google's brand cap (70) is under Meta's (100), so it caps both.
const TENANT_DEFAULT_BRAND_MAX = 70;

module.exports = {
  TENANT_DEFAULT_BRAND_MAX, TENANT_STATUS, CONNECTION_STATUS, PAYMENT_DOMAIN_MODE };
