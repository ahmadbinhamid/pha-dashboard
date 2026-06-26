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
  },

  emailBrand: {
    fromName: get("EMAIL_FROM_NAME", "Vision Dock"),
    fromEmail: get("EMAIL_FROM", "no-reply@vision-dock.test"),
    supportEmail: get("SUPPORT_EMAIL", "support@vision-dock.test"),
    appName: get("APP_NAME", "Vision Dock"),
    clientUrl: get("CLIENT_URL", "http://localhost:3000"),
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
    apiBaseUrl: get(
      "EBAY_API_BASE_URL",
      get("EBAY_SANDBOX", "false") === "true"
        ? "https://api.sandbox.ebay.com"
        : "https://api.ebay.com",
    ),
    taxonomyBaseUrl: get(
      "EBAY_TAXONOMY_BASE_URL",
      get("EBAY_SANDBOX", "false") === "true"
        ? "https://api.sandbox.ebay.com/commerce/taxonomy/v1"
        : "https://api.ebay.com/commerce/taxonomy/v1",
    ),
    // Fallback settings — used when the EbaySettings DB record has no value set
    merchantLocationKey: get("EBAY_MERCHANT_LOCATION_KEY", null),
    fulfillmentPolicyId: get("EBAY_FULFILLMENT_POLICY_ID", null),
    paymentPolicyId: get("EBAY_PAYMENT_POLICY_ID", null),
    returnPolicyId: get("EBAY_RETURN_POLICY_ID", null),
    fallbackImageUrl: get("EBAY_FALLBACK_IMAGE_URL", null),
  },
};

module.exports = config;
