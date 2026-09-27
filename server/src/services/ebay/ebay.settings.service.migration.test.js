// services/ebay/ebay.settings.service.migration.test.js
// getSettings lazily migrates EbaySettings, race-safe, same shape. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const EbaySettings = require("../../models/EbaySettings");
const ChannelConnection = require("../../models/ChannelConnection");
const { encrypt } = require("../../utils/crypto/tokenCipher");
const svc = require("./ebay.settings.service");

test("lazy EbaySettings -> ChannelConnection read-through: identical shape, idempotent under concurrency", async (t) => {
  await mongoose.connect(config.mongoUri);

  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const { ciphertext, iv, tag } = encrypt(`token-${suffix}`);

  await EbaySettings.create({
    tenant_id: tenantId,
    refresh_token_ciphertext: ciphertext,
    refresh_token_iv: iv,
    refresh_token_tag: tag,
    connection_status: "connected",
    connected_at: new Date(),
    marketplace_id: "EBAY_GB",
    sandbox: true,
    fulfillment_policy_id: `FUL-${suffix}`,
    warehouse_city: "London",
    // Unique+sparse index still indexes null, so null-default rows would collide.
    webhook_token: `wt-${suffix}`,
  });

  assert.equal(await ChannelConnection.findOne({ tenant_id: tenantId }).lean(), null, "no ChannelConnection yet");

  // 10 concurrent reads, no ChannelConnection yet: no dupes, identical shapes.
  const results = await Promise.all(Array.from({ length: 10 }, () => svc.getSettings(tenantId)));

  for (const settings of results) {
    assert.equal(settings.marketplace_id, "EBAY_GB");
    assert.equal(settings.warehouse_city, "London");
    assert.equal(settings.fulfillment_policy_id, `FUL-${suffix}`);
    assert.equal(settings.refresh_token, `token-${suffix}`);
    assert.equal(settings.connection_status, "connected");
  }

  const conns = await ChannelConnection.find({ tenant_id: tenantId }).lean();
  assert.equal(conns.length, 1, "exactly one ChannelConnection must exist after concurrent lazy migration");

  await EbaySettings.deleteMany({ tenant_id: tenantId });
  await ChannelConnection.deleteMany({ tenant_id: tenantId });
  await mongoose.disconnect();
});

test("a legacy row with a null/empty refresh token migrates as disconnected, never connected", async (t) => {
  await mongoose.connect(config.mongoUri);

  const tenantId = fixtureId();
  await EbaySettings.create({
    tenant_id: tenantId,
    connection_status: "not_connected",
    // Can't stay null: see the unique+sparse note above.
    webhook_token: `wt-${crypto.randomUUID()}`,
  });

  const settings = await svc.getSettings(tenantId);
  assert.equal(settings.connection_status, "not_connected");
  assert.equal(settings.refresh_token, null);

  const conn = await ChannelConnection.findOne({ tenant_id: tenantId }).lean();
  assert.equal(conn.status, "disconnected");

  await EbaySettings.deleteMany({ tenant_id: tenantId });
  await ChannelConnection.deleteMany({ tenant_id: tenantId });
  await mongoose.disconnect();
});
