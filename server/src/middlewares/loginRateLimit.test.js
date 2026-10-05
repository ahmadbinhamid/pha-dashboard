// middlewares/loginRateLimit.test.js
// Login limits per account and per network; resets aren't starved. Mongo.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");

// Before app loads: a reset request must not send a real email.
const emailService = require("../services/email/email.service");
const resetEmails = [];
mock.method(emailService, "sendPasswordReset", async ({ to }) => {
  resetEmails.push(to);
});

const app = require("../app");
const User = require("../models/User");

const PASSWORD = "Correct-horse-9";
const EDGE_PROXY = "172.18.0.4";
const BLOCKED = { status: "Fail", systemfailure: false, data: null };

let server;
let baseUrl;
let tenantId;

before(async () => {
  await mongoose.connect(config.mongoUri);
  tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Login ${suffix}`, slug: `login-${suffix}`, code: `LG${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});

// A distinct documentation-range client IP per call keeps buckets apart.
let lastIp = 0;
const clientIp = () => `198.51.100.${++lastIp}`;

async function makeUser() {
  const email = `login-${crypto.randomUUID()}@example.com`;
  await User.create({
    tenant_id: tenantId, first_name: "Lo", last_name: "Gin", email, password: PASSWORD,
    role: "user", status: "active", verified_at: new Date(),
  });
  return email;
}

async function post(path, ip, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `${ip}, ${EDGE_PROXY}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const login = (ip, email, password) => post("/login", ip, { email, password });

async function failTimes(ip, email, times) {
  for (let i = 0; i < times; i++) {
    const res = await login(ip, email, "Wrong-password-1");
    assert.equal(res.status, 401, `failure ${i + 1} should be a normal 401`);
  }
}

test("one account failing 5 times is blocked; another email from the same IP still logs in", async () => {
  const ip = clientIp();
  const locked = await makeUser();
  const colleague = await makeUser();
  await failTimes(ip, locked, 5);

  const blocked = await login(ip, locked, PASSWORD);
  assert.equal(blocked.status, 429, "even the right password waits out the window");
  assert.deepEqual({ ...blocked.body, message: undefined }, { ...BLOCKED, message: undefined });
  assert.equal(blocked.body.message, "Too many attempts. Please try again in 15 minutes.");

  // Same address with different case/spacing is still the same account.
  assert.equal((await login(ip, `  ${locked.toUpperCase()} `, PASSWORD)).status, 429);

  const other = await login(ip, colleague, PASSWORD);
  assert.equal(other.status, 200, "the rest of the shop isn't locked out");
});

test("50 failures across many emails from one IP trip the network limit", async () => {
  const ip = clientIp();
  for (let i = 0; i < 50; i++) {
    const res = await login(ip, `spray-${i}-${crypto.randomUUID()}@example.com`, "Wrong-password-1");
    assert.equal(res.status, 401, `failure ${i + 1} is under every limit`);
  }
  const fresh = await makeUser();
  const blocked = await login(ip, fresh, PASSWORD);
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.message, /from this network/);

  assert.equal((await login(clientIp(), fresh, PASSWORD)).status, 200, "another network is unaffected");
});

test("successful logins don't count toward the limit", async () => {
  const ip = clientIp();
  const email = await makeUser();
  await failTimes(ip, email, 4);
  for (let i = 0; i < 6; i++) assert.equal((await login(ip, email, PASSWORD)).status, 200);

  await failTimes(ip, email, 1);
  assert.equal((await login(ip, email, PASSWORD)).status, 429, "only the 5 failures counted");
});

test("a locked-out user can still request a password reset", async () => {
  const ip = clientIp();
  const email = await makeUser();
  await failTimes(ip, email, 5);
  assert.equal((await login(ip, email, PASSWORD)).status, 429);

  const reset = await post("/forgot-password", ip, { email });
  assert.equal(reset.status, 200);
  assert.deepEqual(resetEmails.filter((to) => to === email), [email], "the reset email was requested");
});
