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
    expiresIn: get("JWT_EXPIRES_IN", "2h"),
  },

  security: {
    // 32-byte hex string (64 hex chars) — `openssl rand -hex 32`. Used to
    // encrypt long-lived third-party credentials at rest (currently: each
    // tenant's eBay refresh_token — see utils/crypto/tokenCipher.js).
    encryptionKey: get("ENCRYPTION_KEY", null),
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
    // Multi-tenant — client_id/client_secret belong to OUR eBay Application
    // (shared across every tenant, like a Stripe platform key) and stay
    // global. Everything seller-specific (refresh_token, marketplace,
    // sandbox, policies, warehouse address, webhook token) now lives per-
    // tenant on the EbaySettings model — see ebay.settings.service.js.
    clientId: get("EBAY_CLIENT_ID", null),
    clientSecret: get("EBAY_CLIENT_SECRET", null),
    // Global override (e.g. a proxy) — normally left unset so each tenant's
    // own `sandbox` flag derives the right base URL (see ebay.api.service.js).
    apiBaseUrl: get("EBAY_API_BASE_URL"),
    taxonomyBaseUrl: get("EBAY_TAXONOMY_BASE_URL"),
    // eBay's "RuName" — a redirect-URL identifier you register once in the
    // eBay Developer Portal against this application, pointed at
    // /api/v1/ebay/oauth/callback. Required for the OAuth consent flow
    // (ebay.oauth.service.js) — eBay will not redirect anywhere else.
    redirectUri: get("EBAY_REDIRECT_URI", null),
  },

  stripe: {
    // BYOK — no platform-level secret/webhook/publishable key anymore; each
    // tenant supplies their own via Settings → Payment Account, stored
    // encrypted on their Tenant document (see stripe.keys.service.js).
    // Only the default currency stays global/env-configurable.
    currency: get("STRIPE_CURRENCY", "aud"),
    // Local-dev-only fallback for `stripe listen`, which mints a fresh
    // whsec_ every session that can never match a tenant's real stored
    // secret. Tried ONLY after the tenant's own secret fails, and ONLY
    // outside production — see payment.controller.js#handleWebhook. Paste
    // whatever `stripe listen` prints into this env var each session.
    devWebhookSecret: get("STRIPE_DEV_WEBHOOK_SECRET", null),
  },
};

module.exports = config;
