// utils/redisOptions.test.js
// REDIS_URL parsing; host/port stays byte-identical; passwords never leak.

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const { buildRedisOptions, parseRedisUrl, describeRedisOptions } = require("./redisOptions");
const { logger } = require("../loaders/logging");

// The exact expression every queue file used before this helper.
const legacyOptions = (redis) => ({
  ...(redis.url ? { url: redis.url } : { host: redis.host, port: redis.port }),
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
});

test("REDIS_HOST/REDIS_PORT produce today's exact options, key order included", () => {
  for (const redis of [{ url: null, host: "redis", port: 6379 }, { url: "", host: "10.0.0.5", port: 6380 }]) {
    const built = buildRedisOptions(redis);
    assert.deepEqual(built, legacyOptions(redis));
    assert.deepEqual(Object.keys(built), ["host", "port", "maxRetriesPerRequest", "connectTimeout"]);
  }
});

test("the live config without REDIS_URL matches the legacy options", () => {
  const config = require("../config");
  if (config.redis.url) return;
  assert.deepEqual(buildRedisOptions(), legacyOptions(config.redis));
});

test("redis:// parses host, port, password and db, without TLS", () => {
  assert.deepEqual(buildRedisOptions({ url: "redis://:s3cret@cache.example.com:6380/2" }), {
    host: "cache.example.com", port: 6380, password: "s3cret", db: 2, maxRetriesPerRequest: 1, connectTimeout: 3000,
  });
  assert.deepEqual(parseRedisUrl("redis://localhost"), { host: "localhost", port: 6379 });
  assert.deepEqual(parseRedisUrl("redis://[::1]:6390"), { host: "::1", port: 6390 });
});

test("rediss:// adds TLS, a username and a decoded password", () => {
  assert.deepEqual(parseRedisUrl("rediss://default:p%40ss%2Fw0rd@managed.example.com:25061"), {
    host: "managed.example.com", port: 25061, username: "default", password: "p@ss/w0rd", tls: {},
  });
  assert.deepEqual(parseRedisUrl("rediss://h.example.com/0"), { host: "h.example.com", port: 6379, db: 0, tls: {} });
});

test("bad URLs are rejected without echoing the URL", () => {
  for (const url of ["http://u:hunter2@h:6379", "redis://u:hunter2@h:6379/abc", "redis//u:hunter2@", "rediss://:hunter2@"]) {
    assert.throws(() => buildRedisOptions({ url }), (err) => {
      assert.match(err.message, /REDIS_URL is invalid/);
      assert.ok(!err.message.includes("hunter2"), err.message);
      return true;
    });
  }
});

test("a password never appears in any logged output", () => {
  const lines = [];
  const capture = (...args) => lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  for (const level of ["error", "warn", "info", "debug"]) mock.method(logger, level, capture);
  for (const level of ["error", "warn", "info", "log", "debug"]) mock.method(console, level, capture);
  try {
    const options = buildRedisOptions({ url: "rediss://admin:TopSecret99@managed.example.com:25061/3" });
    lines.push(describeRedisOptions(options));
    try {
      buildRedisOptions({ url: "ftp://admin:TopSecret99@x" });
    } catch (err) {
      logger.error(err.message);
    }
  } finally {
    mock.restoreAll();
  }
  assert.ok(lines.length > 0);
  assert.equal(lines[0], "rediss://managed.example.com:25061/3");
  for (const line of lines) assert.ok(!line.includes("TopSecret99"), line);
});
