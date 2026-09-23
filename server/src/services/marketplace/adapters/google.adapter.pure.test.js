// services/marketplace/adapters/google.adapter.pure.test.js
// TASK 4: the Google adapter is a pure translator — resolved data in, Merchant API call out.
// Runs WITHOUT Mongo: stock/URL/identifiers arrive pre-hydrated on `resolved`.

const test = require("node:test");
const { mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const googleOauth = require("../../google/google.oauth.service");
mock.method(googleOauth, "getValidAccessToken", async () => "tok");

const googleAdapter = require("./google.adapter");

const SETTINGS = { refresh_token_ct: "x", merchant_id: "m1", data_source_id: "ds", feed_label: "AU", content_language: "en", target_country: "AU" };

let bodies;
beforeEach(() => {
  bodies = [];
  mock.method(global, "fetch", async (url, opts) => {
    if (String(url).includes("productInputs:insert")) bodies.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
  });
});

function resolved(overrides = {}) {
  return {
    sku: "G-1",
    title: "Front Brake Disc",
    description: "Vented",
    price: 120,
    photos: [{ url: "https://cdn.example.com/a.jpg" }],
    identifiers: { gtin: null, mpn: null, brand: null },
    category: null,
    stock: { stock_control: true, quantity: 5 },
    productUrl: "https://shop.example.com/product/disc",
    listing: { tenant_id: "t1", condition: "new" },
    product: { _id: "p1", stock_control: true, slug: "disc" },
    ...overrides,
  };
}

test("publish: maps resolved data straight onto the ProductInput (title, link, availability, identifiers)", async () => {
  const result = await googleAdapter.publish(resolved({ identifiers: { gtin: "012345678905", mpn: "M", brand: "B" } }), SETTINGS);
  assert.equal(result.quantity, 5);
  assert.equal(bodies.length, 1);
  const attrs = bodies[0].productAttributes;
  assert.equal(attrs.title, "Front Brake Disc");
  assert.equal(attrs.link, "https://shop.example.com/product/disc");
  assert.equal(attrs.availability, "IN_STOCK");
  assert.deepEqual(attrs.gtins, ["012345678905"]);
  assert.equal(attrs.mpn, undefined);
});

test("publish: quantity 0 from hydration -> OUT_OF_STOCK", async () => {
  await googleAdapter.publish(resolved({ stock: { stock_control: true, quantity: 0 } }), SETTINGS);
  assert.equal(bodies[0].productAttributes.availability, "OUT_OF_STOCK");
});

test("untracked stock (stock_control === false) is skipped before any other check or call", async () => {
  const result = await googleAdapter.publish(
    resolved({ product: { _id: "p1", stock_control: false }, stock: { stock_control: false, quantity: null }, productUrlError: new Error("unreached") }),
    SETTINGS,
  );
  assert.deepEqual(result, { skipped: true, reason: "untracked_stock" });
  assert.equal(bodies.length, 0);
});

test("an UNSET stock_control is still tracked on Google (differs from eBay, deliberately kept)", async () => {
  const result = await googleAdapter.publish(resolved({ product: { _id: "p1", slug: "disc" }, stock: { stock_control: undefined, quantity: 2 } }), SETTINGS);
  assert.equal(result.quantity, 2);
});

test("a product-URL resolution error captured by hydration is raised by the adapter, nothing pushed", async () => {
  await assert.rejects(
    () => googleAdapter.publish(resolved({ productUrl: undefined, productUrlError: new Error("No verified default domain for tenant t1") }), SETTINGS),
    /No verified default domain/,
  );
  assert.equal(bodies.length, 0);
});

test("publishBatch: a batch-wide hydration failure becomes a per-item failure, untracked items still skip", async () => {
  const err = new Error("stock lookup failed");
  const results = await googleAdapter.publishBatch(
    [
      resolved({ hydrationError: err }),
      resolved({ sku: "G-2", product: { _id: "p2", stock_control: false }, hydrationError: err }),
    ],
    SETTINGS,
  );
  assert.deepEqual(results[0], { ok: false, error: "stock lookup failed", status: null });
  assert.deepEqual(results[1], { skipped: true, reason: "untracked_stock" });
  assert.equal(bodies.length, 0);
});
