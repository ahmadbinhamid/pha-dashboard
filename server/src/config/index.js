// config/index.js

require("dotenv").config();

const dns = require("dns");
const path = require("path");

// Some networks advertise a AAAA record for a host that doesn't actually route (found live:
// merchantapi.googleapis.com), and undici doesn't fall back to IPv4 fast enough. Preferring
// IPv4 first avoids that for every outbound call this process makes.
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
    // 32-byte hex string (`openssl rand -hex 32`); encrypts long-lived third-party credentials at rest.
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
    // Conservative defaults for free SMTP sandboxes throttled to a few messages/sec; bump via env on a real provider.
    maxConnections: getNum("SMTP_MAX_CONNECTIONS", 1),
    rateLimit: getNum("SMTP_RATE_LIMIT", 1),
    rateDeltaMs: getNum("SMTP_RATE_DELTA_MS", 1000),
  },

  emailBrand: {
    fromName: get("EMAIL_FROM_NAME", "Vision Dock"),
    fromEmail: get("EMAIL_FROM", "no-reply@vision-dock.test"),
    supportEmail: get("SUPPORT_EMAIL", "support@vision-dock.test"),
    appName: get("APP_NAME", "Vision Dock"),
    // Admin dashboard, used by internal-account emails (e.g. accountVerified's login link).
    clientUrl: get("CLIENT_URL", "http://localhost:3000"),
    // Storefront base URL, for any customer-facing email that needs to link back to it.
    storefrontUrl: get("STOREFRONT_URL", "http://localhost:5174"),
  },

  payment: {
    // Apex domain payment links are built under: "payment.<domain>" for DEFAULT tenants,
    // "<tenant-slug>.<domain>" for VENDOR_SLUG. Left unset in local dev, falling back to CLIENT_URL.
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
    // Resolve relative to this file so the path is stable regardless of where node is invoked from.
    dir: get("UPLOADS_DIR", path.join(__dirname, "../../uploads")),
    url: get("UPLOADS_URL", "http://localhost:7000/uploads"),
  },

  ebay: {
    // Multi-tenant: client_id/client_secret belong to our own eBay Application, shared and
    // global. Everything seller-specific lives per-tenant on EbaySettings.
    clientId: get("EBAY_CLIENT_ID", null),
    clientSecret: get("EBAY_CLIENT_SECRET", null),
    // Global override (e.g. a proxy); normally unset so each tenant's own `sandbox` flag derives the base URL.
    apiBaseUrl: get("EBAY_API_BASE_URL"),
    taxonomyBaseUrl: get("EBAY_TAXONOMY_BASE_URL"),
    // eBay's "RuName", registered once in the Developer Portal, pointed at the OAuth callback.
    redirectUri: get("EBAY_REDIRECT_URI", null),
  },

  google: {
    // Multi-tenant, mirroring config.ebay's shape; everything seller-specific lives per-tenant on ChannelConnection.
    clientId: get("GOOGLE_CLIENT_ID", null),
    clientSecret: get("GOOGLE_CLIENT_SECRET", null),
    // Unlike eBay's RuName indirection, this really is a literal redirect URL registered in the Google Cloud Console.
    redirectUri: get("GOOGLE_REDIRECT_URI", null),
  },

  channels: {
    // ChannelSyncLog TTL.
    syncLogTtlDays: getNum("CHANNEL_SYNC_LOG_TTL_DAYS", 30),
    // Full catalogue syncs can be thousands of listings; logging every success would flood
    // the collection for no benefit. Failures are always logged in full regardless.
    logSuccesses: get("CHANNEL_LOG_SUCCESSES", "false") === "true",
    // Consecutive transport/auth failures before a platform's queue is paused.
    circuitBreakerThreshold: getNum("CHANNEL_CIRCUIT_BREAKER_THRESHOLD", 10),
    // Debounced sync_listing enqueue delay.
    debounceMs: getNum("CHANNEL_SYNC_DEBOUNCE_MS", 5000),
    // sync_batch chunk size: how many listings syncBatch reads per cursor batch before
    // dispatching publishBatch, kept modest so one batch call stays bounded.
    batchChunkSize: getNum("CHANNEL_BATCH_CHUNK_SIZE", 500),
    // Per-queue Bull limiter, keyed by platform. eBay's queue has never had one, so it stays
    // unset by default — only set EBAY_QUEUE_RATE_MAX/_DURATION_MS to newly throttle it.
    rateLimits: {
      ebay:
        getNum("EBAY_QUEUE_RATE_MAX", 0) > 0
          ? { max: getNum("EBAY_QUEUE_RATE_MAX", 0), duration: getNum("EBAY_QUEUE_RATE_DURATION_MS", 1000) }
          : null,
    },
    // Refresh sweep: closes the gap where a channel that expires stale listings (Google: 30
    // days) never gets re-pushed since sync only fires on stock change or connect. Only
    // consumed by an adapter opting in via `refreshIntervalDays`; under Google's real cap for headroom.
    refreshIntervalDays: getNum("CHANNEL_REFRESH_INTERVAL_DAYS", 25),
    // How often the refresh_stale repeatable job runs, per opted-in platform.
    refreshSweepIntervalHours: getNum("CHANNEL_REFRESH_SWEEP_INTERVAL_HOURS", 24),
    // Kill switch checked at sweep time, not schedule-registration time, so flipping this
    // takes effect on the next run with no restart needed.
    refreshSweepEnabled: get("CHANNEL_REFRESH_SWEEP_ENABLED", "true") === "true",
  },

  inventory: {
    // How often the low-stock digest sweep runs; frequent enough that no tenant's exact minute
    // is skipped, matching the tightest existing sweep interval in this codebase.
    digestSweepIntervalMinutes: getNum("INVENTORY_DIGEST_SWEEP_INTERVAL_MINUTES", 5),
    // Kill switch checked at sweep time, same pattern as channels.refreshSweepEnabled above.
    digestSweepEnabled: get("INVENTORY_DIGEST_SWEEP_ENABLED", "true") === "true",
  },

  stripe: {
    // BYOK: no platform-level key anymore, each tenant supplies their own. Only currency stays global.
    currency: get("STRIPE_CURRENCY", "aud"),
    // Local-dev-only fallback for `stripe listen`, which mints a fresh secret every session.
    // Tried only after the tenant's own secret fails, and only outside production.
    devWebhookSecret: get("STRIPE_DEV_WEBHOOK_SECRET", null),
  },

  typesense: {
    // Self-hosted, one shared cluster; every tenant's products live in the same collection
    // scoped by tenant_id, same shared-DB pattern as Mongo.
    host: get("TYPESENSE_HOST", "localhost"),
    port: getNum("TYPESENSE_PORT", 8108),
    protocol: get("TYPESENSE_PROTOCOL", "http"),
    apiKey: get("TYPESENSE_API_KEY", "xyz"),
    connectionTimeoutSeconds: getNum("TYPESENSE_TIMEOUT_SECONDS", 5),
  },
};

module.exports = config;
