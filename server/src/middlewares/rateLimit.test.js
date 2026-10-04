// middlewares/rateLimit.test.js
// Real client IP behind two proxy hops; guest order limit; reads unlimited.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const app = require("../app");

// Edge proxy on the docker network; the socket peer (127.0.0.1) is nginx.
const EDGE_PROXY = "172.18.0.4";
const ORDER_LIMIT = 20;

const servers = [];
function listen(handler) {
  const server = handler.listen(0, "127.0.0.1");
  servers.push(server);
  return new Promise((resolve) => server.on("listening", () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

// What dashboard-web forwards: client chain plus the edge proxy it appended.
const chainFor = (client, injected = []) => [...injected, client, EDGE_PROXY].join(", ");

let appUrl;
let tenantSlug;

before(async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  tenantSlug = `rate-limit-${suffix}`;
  await mongoose.connection.collection("tenants").insertOne({
    _id: fixtureId(), name: `Rate limit ${suffix}`, slug: tenantSlug, code: `RL${suffix}`.toUpperCase(),
    status: "active", deleted_at: null,
  });
  appUrl = await listen(app);
});
after(async () => {
  servers.forEach((s) => s.close());
  await mongoose.disconnect();
});

// Same trust setting as the real app, echoing the resolved req.ip.
async function resolvedIp(trustProxy, xff) {
  const probe = express();
  probe.set("trust proxy", trustProxy);
  probe.get("/ip", (req, res) => res.json({ ip: req.ip }));
  const url = await listen(probe);
  const res = await fetch(`${url}/ip`, { headers: { "X-Forwarded-For": xff } });
  return (await res.json()).ip;
}

const postOrder = (client, injected) =>
  fetch(`${appUrl}/api/v1/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Slug": tenantSlug, "X-Forwarded-For": chainFor(client, injected) },
    body: JSON.stringify({}),
  });

test("req.ip: a two-hop chain resolves to the real client, not the edge proxy", async () => {
  const trust = app.get("trust proxy");
  assert.equal(await resolvedIp(trust, chainFor("203.0.113.7")), "203.0.113.7");
  assert.equal(await resolvedIp(1, chainFor("203.0.113.7")), EDGE_PROXY, "the old setting saw only the proxy");
});

test("req.ip: a client-injected leading X-Forwarded-For entry is ignored", async () => {
  const trust = app.get("trust proxy");
  assert.equal(await resolvedIp(trust, chainFor("203.0.113.7", ["6.6.6.6"])), "203.0.113.7");
  assert.equal(await resolvedIp(trust, chainFor("203.0.113.7", ["10.0.0.1", "6.6.6.6"])), "203.0.113.7");
});

test("guest POST /order: 429 in the existing shape past 20, per client", async () => {
  const clientA = "198.51.100.10";
  for (let i = 0; i < ORDER_LIMIT; i++) {
    const res = await postOrder(clientA);
    assert.notEqual(res.status, 429, `request ${i + 1} is under the limit`);
    await res.arrayBuffer();
  }

  const limited = await postOrder(clientA);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    status: "Fail", systemfailure: false, message: "Too many orders. Please try again in 15 minutes.", data: null,
  });

  const spoofed = await postOrder(clientA, ["192.0.2.99"]);
  assert.equal(spoofed.status, 429, "an injected entry doesn't escape the bucket");
  await spoofed.arrayBuffer();

  const clientB = await postOrder("198.51.100.11");
  assert.notEqual(clientB.status, 429, "a different client has its own bucket");
  assert.equal(clientB.headers.get("ratelimit-remaining"), String(ORDER_LIMIT - 1));
  await clientB.arrayBuffer();
});

test("guest product reads are never IP-limited", async () => {
  for (let i = 0; i < ORDER_LIMIT + 10; i++) {
    const res = await fetch(`${appUrl}/api/v1/product`, {
      headers: { "X-Tenant-Slug": tenantSlug, "X-Forwarded-For": chainFor("198.51.100.20") },
    });
    assert.equal(res.status, 200, `read ${i + 1}`);
    assert.equal(res.headers.get("ratelimit"), null);
    assert.equal(res.headers.get("ratelimit-remaining"), null);
    await res.arrayBuffer();
  }
});
