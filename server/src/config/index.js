// config/index.js

require("dotenv").config();

const path = require("path");

const get = (key, def) => process.env[key] ?? def;
const getNum = (key, def) => {
  const v = process.env[key];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const config = {
  env: get("NODE_ENV", "development"),
  appEnv: get("APP_ENV", "development"),
  port: getNum("PORT", 7000),
  mongoUri: get("MONGO_URI", "mongodb://localhost:27017/partshub-australia"),
  logLevel: get("LOG_LEVEL", "info"),

  jwt: {
    secret: get("JWT_SECRET", "change_me"),
    expiresIn: get("JWT_EXPIRES_IN", "1d"),
  },

  otp: {
    expiryMinutes: getNum("OTP_EXPIRY_MINUTES", 2),
  },

  passwordReset: {
    expiryMinutes: getNum("PASSWORD_RESET_EXPIRY_MINUTES", 15),
  },

  redis: {
    url: get("REDIS_URL", null),
    host: get("REDIS_HOST", "127.0.0.1"),
    port: getNum("REDIS_PORT", 6379),
  },

  smtp: {
    host: get("SMTP_HOST", "sandbox.smtp.mailtrap.io"),
    port: getNum("SMTP_PORT", 2525),
    user: get("SMTP_USER"),
    pass: get("SMTP_PASS"),
    alertsTo: get("ALERTS_TO"),
    salesEmail: get("SALES_EMAIL", "sales@partshubaustralia.com.au"),
    // Conservative defaults for shared/free SMTP sandboxes (e.g. Mailtrap
    // testing plans) that throttle to a handful of messages per second.
    // Bump these via env once on a real provider with higher limits.
    maxConnections: getNum("SMTP_MAX_CONNECTIONS", 1),
    rateLimit: getNum("SMTP_RATE_LIMIT", 1),
    rateDeltaMs: getNum("SMTP_RATE_DELTA_MS", 1000),
  },

  emailBrand: {
    fromName: get("EMAIL_FROM_NAME", "Vision Dock"),
    fromEmail: get("EMAIL_FROM", "no-reply@vision-dock.test"),
    supportEmail: get("SUPPORT_EMAIL", "support@vision-dock.test"),
    appName: get("APP_NAME", "Vision Dock"),
    // Admin dashboard — used by internal-account emails (e.g. accountVerified's login link).
    clientUrl: get("CLIENT_URL", "http://localhost:3000"),
    // Storefront base URL, for any customer-facing email that needs to link back to it.
    storefrontUrl: get("STOREFRONT_URL", "http://localhost:5174"),
  },

  cors: {
    // comma-separated list like: http://localhost:3000,https://staging.example.com
    allowedOrigins: (get("CORS_ALLOWED_ORIGINS", "") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  uploads: {
    // Resolve relative to this file so the path is stable regardless of where node is invoked from
    dir: get("UPLOADS_DIR", path.join(__dirname, "../../uploads")),
    url: get("UPLOADS_URL", "http://localhost:7000/uploads"),
  },

  ebay: {
    clientId: get("EBAY_CLIENT_ID", null),
    clientSecret: get("EBAY_CLIENT_SECRET", null),
    refreshToken: get("EBAY_REFRESH_TOKEN", null),
    marketplaceId: get("EBAY_MARKETPLACE_ID", "EBAY_AU"),
    sandbox: get("EBAY_SANDBOX", "false") === "true",
    apiBaseUrl: get("EBAY_API_BASE_URL"),
    taxonomyBaseUrl: get("EBAY_TAXONOMY_BASE_URL"),
    // Fallback settings — used when the EbaySettings DB record has no value set
    merchantLocationKey: get("EBAY_MERCHANT_LOCATION_KEY", null),
    fulfillmentPolicyId: get("EBAY_FULFILLMENT_POLICY_ID", null),
    paymentPolicyId: get("EBAY_PAYMENT_POLICY_ID", null),
    returnPolicyId: get("EBAY_RETURN_POLICY_ID", null),
    fallbackImageUrl: get("EBAY_FALLBACK_IMAGE_URL", null),
    // Must byte-for-byte match the URL registered in eBay's Marketplace Account Deletion form
    webhookEndpointUrl: get("EBAY_WEBHOOK_ENDPOINT_URL", null),
    // Warehouse address — used to auto-create the merchant location if it doesn't exist on eBay
    warehouseStreet: get("EBAY_WAREHOUSE_STREET", null),
    warehouseCity: get("EBAY_WAREHOUSE_CITY", null),
    warehouseState: get("EBAY_WAREHOUSE_STATE", null),
    warehousePostcode: get("EBAY_WAREHOUSE_POSTCODE", null),
    warehouseCountry: get("EBAY_WAREHOUSE_COUNTRY", "AU"),
    warehousePhone: get("EBAY_WAREHOUSE_PHONE", null),
  },

  stripe: {
    secretKey: get("STRIPE_SECRET_KEY", null),
    webhookSecret: get("STRIPE_WEBHOOK_SECRET", null),
    // Only used server-side as a documented default; the storefront reads its
    // own VITE_STRIPE_PUBLISHABLE_KEY directly and never calls this API for it.
    publishableKey: get("STRIPE_PUBLISHABLE_KEY", null),
    currency: get("STRIPE_CURRENCY", "aud"),
  },
};

module.exports = config;
