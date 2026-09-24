// services/ebay/ebay.settings.migration-script.test.js
// Migration: --dry-run writes nothing; a real run is idempotent. Needs Mongo.

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
const { run } = require("../../../scripts/migrateEbaySettingsToChannelConnection");

const noop = () => {};

test("migrateEbaySettingsToChannelConnection: --dry-run writes nothing, a real run is idempotent", async (t) => {
  await mongoose.connect(config.mongoUri);

  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const { ciphertext, iv, tag } = encrypt(`script-token-${suffix}`);

  await EbaySettings.create({
    tenant_id: tenantId,
    refresh_token_ciphertext: ciphertext,
    refresh_token_iv: iv,
    refresh_token_tag: tag,
    connection_status: "connected",
    marketplace_id: "EBAY_AU",
    // Unique+sparse index still indexes null, so null-default rows would collide.
    webhook_token: `wt-${suffix}`,
  });

  const dryRunResult = await run({ dryRun: true, tenantId: tenantId.toString(), log: noop, logError: noop });
  assert.equal(dryRunResult.migrated, 1, "dry run must report 1 tenant it would migrate");
  assert.equal(
    await ChannelConnection.findOne({ tenant_id: tenantId }).lean(),
    null,
    "--dry-run must not create a ChannelConnection document",
  );

  const realRunResult = await run({ dryRun: false, tenantId: tenantId.toString(), log: noop, logError: noop });
  assert.equal(realRunResult.migrated, 1);
  const conns = await ChannelConnection.find({ tenant_id: tenantId }).lean();
  assert.equal(conns.length, 1, "exactly one ChannelConnection must be created");

  const secondRunResult = await run({ dryRun: false, tenantId: tenantId.toString(), log: noop, logError: noop });
  assert.equal(secondRunResult.migrated, 0, "re-running must not re-migrate an already-migrated tenant");
  assert.equal(secondRunResult.skipped, 1, "re-running must report the tenant as skipped");
  const connsAfterRerun = await ChannelConnection.find({ tenant_id: tenantId }).lean();
  assert.equal(connsAfterRerun.length, 1, "re-running must not create a duplicate ChannelConnection document");

  await EbaySettings.deleteMany({ tenant_id: tenantId });
  await ChannelConnection.deleteMany({ tenant_id: tenantId });
  await mongoose.disconnect();
});
