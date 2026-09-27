// services/marketplace/circuitBreaker.test.js
// Only transport/auth failures trip the breaker, not 400s. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelConnection = require("../../models/ChannelConnection");
const circuitBreaker = require("./circuitBreaker");

function transportError(status) {
  const err = new Error("transport failure");
  err.status = status;
  return err;
}

function validationError() {
  const err = new Error("Missing required field: GTIN");
  err.status = 400;
  return err;
}

test("circuit breaker: item validation errors never trip it, transport/auth errors do at the threshold", async (t) => {
  await mongoose.connect(config.mongoUri);

  const tenantId = fixtureId();
  const platform = "ebay";
  const threshold = config.channels.circuitBreakerThreshold;

  // A burst of 400s well past the threshold must never bump consecutive_failures.
  for (let i = 0; i < threshold + 5; i++) {
    await circuitBreaker.recordFailure(tenantId, platform, validationError());
  }
  assert.equal(await circuitBreaker.isOpen(tenantId, platform), false, "validation errors must never open the circuit");
  const afterValidation = await ChannelConnection.findOne({ tenant_id: tenantId, platform }).lean();
  assert.equal(afterValidation, null, "validation errors that never count must never even create a ChannelConnection row");

  // Fewer than threshold transport errors: not tripped yet.
  for (let i = 0; i < threshold - 1; i++) {
    await circuitBreaker.recordFailure(tenantId, platform, transportError(503));
  }
  assert.equal(await circuitBreaker.isOpen(tenantId, platform), false, "must not trip before reaching the threshold");

  // One more (401, the auth branch) reaches the threshold and trips it.
  const { tripped } = await circuitBreaker.recordFailure(tenantId, platform, transportError(401));
  assert.equal(tripped, true);
  assert.equal(await circuitBreaker.isOpen(tenantId, platform), true, "must be open once the threshold is reached");

  // A success doesn't resume a tripped breaker; only an explicit resume does.
  await circuitBreaker.recordSuccess(tenantId, platform);
  const afterSuccess = await ChannelConnection.findOne({ tenant_id: tenantId, platform }).lean();
  assert.equal(afterSuccess.consecutive_failures, 0);
  assert.equal(afterSuccess.status, "connected");
  assert.ok(afterSuccess.last_success_at);

  // Trip it again, then resume.
  for (let i = 0; i < threshold; i++) {
    await circuitBreaker.recordFailure(tenantId, platform, transportError(500));
  }
  assert.equal(await circuitBreaker.isOpen(tenantId, platform), true);
  await circuitBreaker.resume(tenantId, platform);
  assert.equal(await circuitBreaker.isOpen(tenantId, platform), false);
  const afterResume = await ChannelConnection.findOne({ tenant_id: tenantId, platform }).lean();
  assert.equal(afterResume.consecutive_failures, 0);
  assert.equal(afterResume.last_error, null);

  await ChannelConnection.deleteMany({ tenant_id: tenantId });
  await mongoose.disconnect();
});
