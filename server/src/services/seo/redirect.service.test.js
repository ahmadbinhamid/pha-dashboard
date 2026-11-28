// services/seo/redirect.service.test.js
// Redirect paths normalise, protected paths and loops are refused. Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const redirectService = require("./redirect.service");

const TENANT = fixtureId();

test.before(() => mongoose.connect(config.mongoUri));
test.after(() => mongoose.disconnect());

test("normalizePath strips host, query, case and trailing slash", () => {
  const { normalizePath } = redirectService;
  assert.equal(normalizePath("https://old.site/Brake-Pads/?utm=x#top"), "/brake-pads");
  assert.equal(normalizePath("brake-pads"), "/brake-pads");
  assert.equal(normalizePath("/"), "/");
});

test("matches the messy URL people actually request, and counts it", async () => {
  await redirectService.createRedirect(TENANT, { from_path: "/old-page", to_path: "/new-page", type: 301 });
  const hit = await redirectService.resolveRedirect(TENANT, "/Old-Page/?ref=google");
  assert.deepEqual(hit, { to: "/new-page", status: 301 });
  await redirectService.resolveRedirect(TENANT, "/old-page");
  const { items } = await redirectService.listRedirects(TENANT, { search: "old-page" });
  assert.equal(items[0].hits, 2);
  assert.equal(await redirectService.resolveRedirect(TENANT, "/nothing-here"), null);
});

test("home, checkout and cart can't be redirected", async () => {
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/", to_path: "/shop" }), /home page/);
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/checkout/payment", to_path: "/" }), /checkout/);
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/cart", to_path: "/" }), /checkout or the site/);
});

test("self-redirects, loops and duplicates are refused", async () => {
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/same", to_path: "/same" }), /itself/);
  await redirectService.createRedirect(TENANT, { from_path: "/a", to_path: "/b" });
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/b", to_path: "/a" }), /redirects back/);
  await assert.rejects(redirectService.createRedirect(TENANT, { from_path: "/A/", to_path: "/c" }), /already has a redirect/);
});
