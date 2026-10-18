// scripts/migrateFlashSaleToDiscount.js
// Inline storefront flash sales become featured Discounts, dry run by default.

const { runScript } = require("../src/utils/scriptCli");
const { migrateLegacyFlashSales } = require("../src/services/flash-sale-migration.service");

void runScript(async ({ dryRun, tenantId }, log) => {
  const rows = await migrateLegacyFlashSales({ dryRun, tenantId });
  if (!rows.length) log("No legacy flash sales to migrate.");
  for (const row of rows) log(`  tenant ${row.tenantId}  ${row.code.padEnd(24)} ${row.action}`);
  if (dryRun && rows.length) log("\nDry run: nothing written. Re-run with --confirm to apply.");
});
