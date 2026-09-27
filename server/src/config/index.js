// config/index.js

require("dotenv").config();

const dns = require("dns");
const path = require("path");

// Some hosts publish unroutable AAAA records; undici falls back to IPv4 slowly.
dns.setDefaultResultOrder("ipv4first");

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
    // 32-byte hex key; encrypts stored third-party credentials at rest.
    encryptionKey: get("ENCRYPTION_KEY", null),
  },

  otp: {
    expiryMinutes: getNum("OTP_EXPIRY_MINUTES", 2),
  },

  passwordReset: {
    expiryMinutes: getNum("PASSWORD_RESET_EXPIRY_MINUTES", 15),
  },

  // Team invites: set-password link lifetime and minimum gap between resends.
  invites: {
    expiryHours: getNum("USER_INVITE_EXPIRY_HOURS", 24),
    resendCooldownSeconds: getNum("USER_INVITE_RESEND_COOLDOWN_SECONDS", 120),
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
    // Suits throttled SMTP sandboxes; raise on a real provider.
    maxConnections: getNum("SMTP_MAX_CONNECTIONS", 1),
    rateLimit: getNum("SMTP_RATE_LIMIT", 1),
    rateDeltaMs: getNum("SMTP_RATE_DELTA_MS", 1000),
  },

  emailBrand: {
    fromName: get("EMAIL_FROM_NAME", "Vision Dock"),
    fromEmail: get("EMAIL_FROM", "no-reply@vision-dock.test"),
    supportEmail: get("SUPPORT_EMAIL", "support@vision-dock.test"),
    appName: get("APP_NAME", "Vision Dock"),
    // Admin dashboard base URL, linked from internal-account emails.
    clientUrl: get("CLIENT_URL", "http://localhost:3000"),
    // Storefront base URL, linked from customer-facing emails.
    storefrontUrl: get("STOREFRONT_URL", "http://localhost:5174"),
  },

  payment: {
    // payment.<domain> or <slug>.<domain>; unset falls back to CLIENT_URL.
    linkDomain: get("PAYMENT_LINK_DOMAIN", null),
  },

  cors: {
    // comma-separated list like: http://localhost:3000,https://staging.example.com
    allowedOrigins: (get("CORS_ALLOWED_ORIGINS", "") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  uploads: {
    // Relative to this file so the path doesn't depend on the process cwd.
    dir: get("UPLOADS_DIR", path.join(__dirname, "../../uploads")),
    url: get("UPLOADS_URL", "http://localhost:7000/uploads"),
  },

  ebay: {
    // Our shared eBay app credentials; seller-specific data lives on EbaySettings.
    clientId: get("EBAY_CLIENT_ID", null),
    clientSecret: get("EBAY_CLIENT_SECRET", null),
    // Global override (e.g. a proxy); unset lets each tenant's sandbox flag decide.
    apiBaseUrl: get("EBAY_API_BASE_URL"),
    taxonomyBaseUrl: get("EBAY_TAXONOMY_BASE_URL"),
    // eBay "RuName" registered in the Developer Portal, not a literal URL.
    redirectUri: get("EBAY_REDIRECT_URI", null),
  },

  google: {
    // Shared app credentials; seller-specific data lives on ChannelConnection.
    clientId: get("GOOGLE_CLIENT_ID", null),
    clientSecret: get("GOOGLE_CLIENT_SECRET", null),
    // A literal redirect URL registered in the Google Cloud Console.
    redirectUri: get("GOOGLE_REDIRECT_URI", null),
  },

  channels: {
    syncLogTtlDays: getNum("CHANNEL_SYNC_LOG_TTL_DAYS", 30),
    // Off by default: full syncs would flood the log; failures are always logged.
    logSuccesses: get("CHANNEL_LOG_SUCCESSES", "false") === "true",
    // Consecutive transport/auth failures before a platform's queue is paused.
    circuitBreakerThreshold: getNum("CHANNEL_CIRCUIT_BREAKER_THRESHOLD", 10),
    debounceMs: getNum("CHANNEL_SYNC_DEBOUNCE_MS", 5000),
    // Listings per syncBatch cursor chunk; modest so one publish stays bounded.
    batchChunkSize: getNum("CHANNEL_BATCH_CHUNK_SIZE", 500),
    // Per-platform Bull limiter; eBay is unthrottled unless EBAY_QUEUE_RATE_*.
    rateLimits: {
      ebay:
        getNum("EBAY_QUEUE_RATE_MAX", 0) > 0
          ? { max: getNum("EBAY_QUEUE_RATE_MAX", 0), duration: getNum("EBAY_QUEUE_RATE_DURATION_MS", 1000) }
          : null,
    },
    // Re-push before channels expire listings (Google: 30 days); adapter opt-in.
    refreshIntervalDays: getNum("CHANNEL_REFRESH_INTERVAL_DAYS", 25),
    refreshSweepIntervalHours: getNum("CHANNEL_REFRESH_SWEEP_INTERVAL_HOURS", 24),
    // Checked at sweep time, so flipping it takes effect without a restart.
    refreshSweepEnabled: get("CHANNEL_REFRESH_SWEEP_ENABLED", "true") === "true",
  },

  inventory: {
    // Frequent enough that no tenant's configured digest minute is skipped.
    digestSweepIntervalMinutes: getNum("INVENTORY_DIGEST_SWEEP_INTERVAL_MINUTES", 5),
    // Checked at sweep time, so flipping it takes effect without a restart.
    digestSweepEnabled: get("INVENTORY_DIGEST_SWEEP_ENABLED", "true") === "true",
  },

  stripe: {
    // BYOK: each tenant supplies its own Stripe keys; only currency is global.
    currency: get("STRIPE_CURRENCY", "aud"),
    // Non-production fallback for `stripe listen`, tried after the tenant's secret.
    devWebhookSecret: get("STRIPE_DEV_WEBHOOK_SECRET", null),
  },

  typesense: {
    // One shared cluster; tenants share a collection scoped by tenant_id.
    host: get("TYPESENSE_HOST", "localhost"),
    port: getNum("TYPESENSE_PORT", 8108),
    protocol: get("TYPESENSE_PROTOCOL", "http"),
    apiKey: get("TYPESENSE_API_KEY", "xyz"),
    connectionTimeoutSeconds: getNum("TYPESENSE_TIMEOUT_SECONDS", 5),
  },
};

module.exports = config;
