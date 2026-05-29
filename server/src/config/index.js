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
  mongoUri: get("MONGO_URI", "mongodb://localhost:27017/vcvs"),
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
  },
};

module.exports = config;
