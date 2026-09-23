// services/ebay/ebay.settings.migration-script.test.js
// Regression guard: --dry-run writes nothing; a real run is idempotent (re-run skips already-migrated tenants).
// Needs a live Mongo connection. Run: node --test src/services/ebay/ebay.settings.migration-script.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
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
  const tenantId = new mongoose.Types.ObjectId();
  const { ciphertext, iv, tag } = encrypt(`script-token-${suffix}`);

  await EbaySettings.create({
    tenant_id: tenantId,
    refresh_token_ciphertext: ciphertext,
    refresh_token_iv: iv,
    refresh_token_tag: tag,
    connection_status: "connected",
    marketplace_id: "EBAY_AU",
    // webhook_token is unique+sparse; sparse excludes only absent fields, not null, so two
    // null-defaulted rows would collide. Set explicitly so this test doesn't depend on being the only such row.
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
