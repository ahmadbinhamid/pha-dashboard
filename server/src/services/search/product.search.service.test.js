// services/search/product.search.service.test.js
// Part-number tiers run only for digit-bearing queries; mocked client.
const test = require("node:test");
const { mock, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const typesenseClient = require("./typesense.client");

const calls = [];
let resultFor = () => ({ found: 0, hits: [] });

const fakeClient = {
  collections: () => ({
    documents: () => ({
      search: async (params) => {
        calls.push(params);
        return resultFor(params);
      },
    }),
  }),
};

// Must be mocked before the service destructures getTypesenseClient.
mock.method(typesenseClient, "getTypesenseClient", () => fakeClient);
const { searchProducts, suggestProducts } = require("./product.search.service");

const hit = (id) => ({ found: 1, hits: [{ document: { id } }] });

beforeEach(() => {
  calls.length = 0;
  resultFor = () => ({ found: 0, hits: [] });
});

test("multi-word title query skips sku/mpn tiers", async () => {
  resultFor = (p) => (p.query_by === "mpn" ? hit("brake-kit") : hit("bracket"));

  const { ids } = await searchProducts({
    q: "JEEP GRAND CHEROKEE WK2 RIGHT HEADLIGHT BRACKET",
    tenantId: "t1",
  });

  assert.deepEqual(ids, ["bracket"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query_by, /title/);
});

test("single-word non-numeric query uses the full search", async () => {
  await searchProducts({ q: "headlight", tenantId: "t1" });

  assert.equal(calls.length, 1);
  assert.match(calls[0].query_by, /title/);
});

test("sku match short-circuits before mpn and full search", async () => {
  resultFor = (p) => (p.query_by === "sku" ? hit("sku-hit") : hit("other"));

  const { ids } = await searchProducts({ q: "PHA-000169", tenantId: "t1" });

  assert.deepEqual(ids, ["sku-hit"]);
  assert.deepEqual(calls.map((c) => c.query_by), ["sku"]);
  assert.equal(calls[0].drop_tokens_threshold, 0);
});

test("partial numeric query falls through sku to mpn", async () => {
  resultFor = (p) => (p.query_by === "mpn" ? hit("mpn-hit") : { found: 0, hits: [] });

  const { ids } = await searchProducts({ q: "169", tenantId: "t1" });

  assert.deepEqual(ids, ["mpn-hit"]);
  assert.deepEqual(calls.map((c) => c.query_by), ["sku", "mpn"]);
});

test("spaced part number still uses the tiers", async () => {
  await searchProducts({ q: "68 123 456", tenantId: "t1" });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.slice(0, 2).map((c) => c.query_by), ["sku", "mpn"]);
  assert.match(calls[2].query_by, /title/);
});

test("empty query browses all without tiers", async () => {
  await searchProducts({ q: "", tenantId: "t1" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].q, "*");
});

test("suggest applies the same gate with prefix and published filter", async () => {
  resultFor = () => hit("x");

  await suggestProducts({ tenantId: "t1", q: "jeep headlight" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].prefix, true);
  assert.match(calls[0].filter_by, /is_published_online:=true/);
});
