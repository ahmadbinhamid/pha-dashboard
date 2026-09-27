// scripts/migrateTenantAdminRoles.js
// Merges each tenant's old Super Admin + Admin roles into one Admin role.
// Usage: [--confirm] [--tenant=<id>]  (dry run unless --confirm)

const { migrateTenantAdminRoles } = require("../src/services/role.service");

async function run({ dryRun = true, tenantId = null, log = console.log } = {}) {
  const result = await migrateTenantAdminRoles({ dryRun, tenantId });
  for (const r of result.results) {
    log(
      `  tenant ${r.tenant_id}: ${r.moved_members} member(s) + ${r.moved_invites} invite(s) from old Admin` +
        `${r.removed_old_admin ? ", old Admin role removed" : ""}, Super Admin renamed to Admin`,
    );
  }
  log(`\n${dryRun ? "Would migrate" : "Migrated"} ${result.tenants} tenant(s).${dryRun ? " Re-run with --confirm to apply." : ""}`);
  return result;
}

module.exports = { run };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");

  const dryRun = !process.argv.includes("--confirm");
  const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
  const tenantId = tenantArg ? tenantArg.split("=")[1] : null;

  (async () => {
    await mongoose.connect(config.mongoUri);
    console.log(`Connected to MongoDB${dryRun ? " (dry run: no writes)" : ""}`);
    await run({ dryRun, tenantId });
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("migrateTenantAdminRoles failed:", err);
    process.exit(1);
  });
}
