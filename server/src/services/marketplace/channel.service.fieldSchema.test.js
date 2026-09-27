// services/marketplace/channel.service.fieldSchema.test.js
// GET /channels serves fieldSchemas with static options. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const registry = require("./registry");
registry.register(require("./adapters/ebay.adapter"));
registry.register(require("./adapters/google.adapter"));
const { listChannelsForTenant } = require("./channel.service");

test("listChannelsForTenant: each channel carries its fieldSchema with static options, existing keys intact", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const channels = await listChannelsForTenant(fixtureId());
  const byKey = Object.fromEntries(channels.map((c) => [c.key, c]));

  for (const key of ["ebay", "google"]) {
    const c = byKey[key];
    for (const existing of ["name", "capabilities", "available", "connection", "health", "listing_counts"]) {
      assert.ok(existing in c, `${key}: existing response key "${existing}" must survive`);
    }
    assert.ok(Array.isArray(c.fieldSchema) && c.fieldSchema.length > 0, `${key}: fieldSchema served`);
  }

  const ebayCondition = byKey.ebay.fieldSchema.find((d) => d.key === "condition");
  assert.deepEqual(ebayCondition.options.map((o) => o.value), ["NEW", "USED"]);
  const policy = byKey.ebay.fieldSchema.find((d) => d.key === "fulfillment_policy_id");
  assert.equal(policy.options, undefined, "dynamic sources are resolved by the UI, not inlined");
  assert.equal(byKey.ebay.productConstraints.title.maxLength, 80);
});
