// services/ebay/ebay.api.condition.test.js
// Regression guard: "USED" maps to USED_EXCELLENT not USED_GOOD (a media grade), and falsy condition throws.
// Pure function, no Mongo/Redis/network. Run: node --test src/services/ebay/ebay.api.condition.test.js

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeCondition } = require("./ebay.api.service");

test('normalizeCondition("USED") === "USED_EXCELLENT"', () => {
  assert.equal(normalizeCondition("USED"), "USED_EXCELLENT");
});

test("normalizeCondition passes a specific enum value through unchanged", () => {
  assert.equal(normalizeCondition("USED_GOOD"), "USED_GOOD");
  assert.equal(normalizeCondition("NEW"), "NEW");
});

test("normalizeCondition(undefined) throws, naming the SKU when given one", () => {
  assert.throws(() => normalizeCondition(undefined, "SKU-123"), /SKU-123/);
});

test("normalizeCondition(null) throws even with no SKU available", () => {
  assert.throws(() => normalizeCondition(null), /condition is required/i);
});

test("normalizeCondition's thrown error is classified as a per-item data failure, not transport/auth", () => {
  let caught = null;
  try {
    normalizeCondition("", "SKU-456");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught);
  assert.equal(caught.status, 400);
});
