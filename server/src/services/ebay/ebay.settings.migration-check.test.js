// services/ebay/ebay.settings.migration-check.test.js
// scripts/checkEbaySettingsMigrated.js: reports a legacy EbaySettings tenant with no live eBay
// ChannelConnection, and never one that has been migrated. Read-only. Needs a live Mongo connection.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../config");

require("../../models/index");
const EbaySettings = require("../../models/EbaySettings");
const ChannelConnection = require("../../models/ChannelConnection");
const { run } = require("../../../scripts/checkEbaySettingsMigrated");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const quiet = () => {};

test("checkEbaySettingsMigrated: an unmigrated tenant is reported; a migrated or soft-deleted one is not double-counted", async () => {
  const [pending, migrated, softDeleted] = [0, 1, 2].map(() => new mongoose.Types.ObjectId());
  await EbaySettings.collection.insertMany([pending, migrated, softDeleted].map((tenant_id) => ({ tenant_id, connection_status: "connected" })));
  await ChannelConnection.collection.insertMany([
    { tenant_id: migrated, platform: "ebay", status: "connected", deleted_at: null },
    { tenant_id: softDeleted, platform: "ebay", status: "connected", deleted_at: new Date() },
  ]);

  assert.deepEqual(await run({ tenantId: pending, log: quiet }), { unmigrated: 1, tenants: [String(pending)] });
  assert.deepEqual(await run({ tenantId: migrated, log: quiet }), { unmigrated: 0, tenants: [] });
  assert.equal((await run({ tenantId: softDeleted, log: quiet })).unmigrated, 1, "a soft-deleted connection isn't a live migration");

  const tenants = { $in: [pending, migrated, softDeleted] };
  assert.equal(await EbaySettings.countDocuments({ tenant_id: tenants }), 3, "read-only: nothing is created or deleted");

  // Shared dev/test DB: leftover rows would show up in the real operator report.
  await EbaySettings.collection.deleteMany({ tenant_id: tenants });
  await ChannelConnection.collection.deleteMany({ tenant_id: tenants });
});
