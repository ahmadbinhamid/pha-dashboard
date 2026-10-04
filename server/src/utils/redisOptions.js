// utils/redisOptions.js
// One ioredis option set for every Redis client; REDIS_URL wins when set.

const config = require("../config");

// Unchanged from what every queue used before.
const CLIENT_DEFAULTS = Object.freeze({ maxRetriesPerRequest: 1, connectTimeout: 3000 });
const DEFAULT_PORT = 6379;
const SCHEMES = Object.freeze({ "redis:": false, "rediss:": true });

// Never echoes the URL: it may carry a password.
function invalidUrl(reason) {
  return new Error(`REDIS_URL is invalid (${reason}); expected redis://[user:password@]host[:port][/db]`);
}

/** host/port/username/password/db/tls from a redis:// or rediss:// URL. */
function parseRedisUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw invalidUrl("not a URL");
  }
  if (!Object.hasOwn(SCHEMES, parsed.protocol)) throw invalidUrl("scheme must be redis:// or rediss://");
  if (!parsed.hostname) throw invalidUrl("missing host");

  // IPv6 hosts parse as "[::1]"; ioredis wants the bare address.
  const host = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
  const options = { host, port: parsed.port ? Number(parsed.port) : DEFAULT_PORT };
  if (parsed.username) options.username = decodeURIComponent(parsed.username);
  if (parsed.password) options.password = decodeURIComponent(parsed.password);

  const dbPath = parsed.pathname.replace(/^\//, "");
  if (dbPath) {
    if (!/^\d+$/.test(dbPath)) throw invalidUrl("db must be a number");
    options.db = Number(dbPath);
  }
  // NOTE: rediss:// enables TLS with Node's defaults (certificate checks on).
  if (SCHEMES[parsed.protocol]) options.tls = {};
  return options;
}

/** ioredis options for Bull's `redis` setting. */
function buildRedisOptions(redis = config.redis) {
  const connection = redis.url ? parseRedisUrl(redis.url) : { host: redis.host, port: redis.port };
  return { ...connection, ...CLIENT_DEFAULTS };
}

/** Loggable form of the options; the password is never included. */
function describeRedisOptions({ host, port, db, tls }) {
  return `${tls ? "rediss" : "redis"}://${host}:${port}${db != null ? `/${db}` : ""}`;
}

module.exports = { buildRedisOptions, parseRedisUrl, describeRedisOptions };
