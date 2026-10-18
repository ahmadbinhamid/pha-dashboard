// scripts/migrateCustomerBusinesses.js
// Customer company names become linked businesses, dry run by default.

const { runScript } = require("../src/utils/scriptCli");
const { migrateCustomerCompanies } = require("../src/services/business-migration.service");

void runScript(async ({ dryRun, tenantId }, log) => {
  const rows = await migrateCustomerCompanies({ dryRun, tenantId });
  if (!rows.length) log("No customer company names to migrate.");
  for (const row of rows) log(`  ${row.tenant_id}  ${row.name.padEnd(40)} ${String(row.customers).padStart(4)}  ${row.action}`);
  if (dryRun && rows.length) log("\nDry run: nothing written. Re-run with --confirm to apply.");
});
