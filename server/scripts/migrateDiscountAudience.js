// scripts/migrateDiscountAudience.js
// Legacy discount audiences become order-number ranges, dry run by default.

const { runScript } = require("../src/utils/scriptCli");
const { migrateLegacyAudience } = require("../src/services/discount-migration.service");

const range = (min, max) => (min || max ? `orders ${min ?? 1}-${max ?? "∞"}` : "any order");

void runScript(async ({ dryRun, tenantId }, log) => {
  const rows = await migrateLegacyAudience({ dryRun, tenantId });
  if (!rows.length) log("No legacy discounts to migrate.");
  for (const row of rows) log(`  ${row.name.padEnd(32)} ${range(row.min_order_number, row.max_order_number).padEnd(16)} ${row.action}`);
  if (dryRun && rows.length) log("\nDry run: nothing written. Re-run with --confirm to apply.");
});
