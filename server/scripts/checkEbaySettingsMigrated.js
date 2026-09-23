// Read-only: tenants with EbaySettings but no eBay ChannelConnection (exit 2 if any).
// Usage: [--tenant=<id>] [--dry-run (no-op)]

const { listUnmigratedLegacyTenants } = require("../src/services/ebay/ebay.settings.service");

async function run({ tenantId = null, log = console.log } = {}) {
  const rows = await listUnmigratedLegacyTenants({ tenantId });
  log(`Tenants with EbaySettings but no eBay ChannelConnection: ${rows.length}`);
  for (const row of rows) log(`  tenant ${row.tenant_id} (legacy connection_status=${row.connection_status ?? "n/a"})`);
  log(rows.length ? "NOT safe to delete EbaySettings yet." : "All migrated — EbaySettings is safe to retire.");
  return { unmigrated: rows.length, tenants: rows.map((r) => String(r.tenant_id)) };
}

module.exports = { run };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");

  const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
  const tenantId = tenantArg ? tenantArg.split("=")[1] : null;

  (async () => {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB (read-only check: no writes are ever made)");
    const { unmigrated } = await run({ tenantId });
    await mongoose.disconnect();
    process.exitCode = unmigrated ? 2 : 0;
  })().catch((err) => {
    console.error("checkEbaySettingsMigrated failed:", err);
    process.exit(1);
  });
}
