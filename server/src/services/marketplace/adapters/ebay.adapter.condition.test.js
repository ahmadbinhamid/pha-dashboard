// services/marketplace/adapters/ebay.adapter.condition.test.js
// Regression guard: resolveCategoryCondition must not treat "unverifiable" and "verified fine"
// as the same outcome. No Mongo/Redis needed; getConditionPolicies is mocked directly.
// Run: node --test src/services/marketplace/adapters/ebay.adapter.condition.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");

const catalogService = require("../../ebay/ebay.catalog.service");
const getConditionPoliciesMock = mock.method(catalogService, "getConditionPolicies", async () => ({ conditions: [] }));

const loggingModule = require("../../../loaders/logging");
const warnSpy = mock.method(loggingModule.logger, "warn", () => {});

const { resolveCategoryCondition, ConditionUnverifiedError } = require("./ebay.adapter");
const circuitBreaker = require("../circuitBreaker");

const FAKE_SETTINGS = { tenant_id: "t1", marketplace_id: "EBAY_AU", sandbox: false };

test("policy list contains the fallback condition -> used as-is, no warning logged", async () => {
  warnSpy.mock.resetCalls();
  getConditionPoliciesMock.mock.mockImplementation(async () => ({
    conditions: [{ conditionId: "USED_GOOD" }, { conditionId: "NEW" }],
  }));

  const result = await resolveCategoryCondition("NEW", "12345", FAKE_SETTINGS, "SKU-1");
  assert.equal(result, "NEW");
  assert.equal(warnSpy.mock.callCount(), 0, "the verified happy path must stay silent");
});

test("policy list excludes USED_GOOD but includes USED_EXCELLENT -> USED_EXCELLENT chosen", async () => {
  warnSpy.mock.resetCalls();
  getConditionPoliciesMock.mock.mockImplementation(async () => ({
    conditions: [{ conditionId: "USED_EXCELLENT" }, { conditionId: "USED_ACCEPTABLE" }],
  }));

  // "USED_GOOD" passes through normalizeCondition unchanged but isn't accepted here, forcing
  // the CONDITION_FALLBACK_ORDER.used search to land on USED_EXCELLENT (a real parts grade).
  const result = await resolveCategoryCondition("USED_GOOD", "12345", FAKE_SETTINGS, "SKU-2");
  assert.equal(result, "USED_EXCELLENT");
  assert.equal(warnSpy.mock.callCount(), 1, "picking a fallback within the family is worth a warning");
});

test("empty policy list -> throws ConditionUnverifiedError classified as a per-item data failure, not transport/auth", async () => {
  warnSpy.mock.resetCalls();
  getConditionPoliciesMock.mock.mockImplementation(async () => ({ conditions: [] }));

  await assert.rejects(
    () => resolveCategoryCondition("NEW", "12345", FAKE_SETTINGS, "SKU-3"),
    (err) => {
      assert.ok(err instanceof ConditionUnverifiedError);
      assert.equal(err.code, "CONDITION_UNVERIFIED");
      assert.equal(err.status, 400);
      // A bad/unverifiable condition on one listing must never count toward the circuit breaker.
      assert.equal(circuitBreaker.isTransportOrAuthFailure(err), false, "must NOT count toward the circuit breaker");
      return true;
    },
  );
  assert.ok(warnSpy.mock.callCount() >= 1, "an unverified condition must be logged, not just thrown silently");
});

test("policy lookup throws -> same treatment as an empty list", async () => {
  warnSpy.mock.resetCalls();
  getConditionPoliciesMock.mock.mockImplementation(async () => {
    throw new Error("network blip");
  });

  await assert.rejects(
    () => resolveCategoryCondition("NEW", "12345", FAKE_SETTINGS, "SKU-4"),
    (err) => {
      assert.ok(err instanceof ConditionUnverifiedError);
      assert.equal(err.code, "CONDITION_UNVERIFIED");
      assert.equal(err.status, 400);
      assert.match(err.message, /network blip/, "the underlying lookup error must be visible in the thrown message");
      assert.equal(circuitBreaker.isTransportOrAuthFailure(err), false);
      return true;
    },
  );
  assert.ok(warnSpy.mock.callCount() >= 1);
});
