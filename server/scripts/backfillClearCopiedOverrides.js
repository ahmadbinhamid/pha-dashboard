// scripts/backfillClearCopiedOverrides.js
//
// Nulls listing overrides (title/description/price/photos) that are copies of the current
// product/variant value — artifacts of the old listing form prefilling them — so product
// edits reach the channel again. An override that differs from the product is never touched.
// Logic lives in services/marketplace/listingOverride.service.js.
//
// Usage:
//   node scripts/backfillClearCopiedOverrides.js [--dry-run] [--tenant=<tenantId>]
//                                                [--include-generated-descriptions]
//
//   --dry-run                          Report what would change; writes nothing.
//   --tenant=<id>                      Only this tenant's listings.
//   --include-generated-descriptions   Also clear eBay descriptions that are the app's own
//                                      generated template (users never author these); eBay
//                                      then re-renders them from live data on next sync.
//
// Idempotent: each write re-checks the stored value, so re-runs and concurrent edits are safe.

const { clearCopiedOverrides, OVERRIDE_FIELDS } = require("../src/services/marketplace/listingOverride.service");

function printCounts(log, label, counts) {
  log(`${label}:`);
  for (const field of OVERRIDE_FIELDS) log(`  ${field.padEnd(22)} ${counts[field]}`);
}

async function run({ dryRun = false, tenantId = null, includeGeneratedDescriptions = false, log = console.log } = {}) {
  log(`Scope: ${tenantId ? `tenant ${tenantId}` : "all tenants"}${includeGeneratedDescriptions ? " (including generated eBay descriptions)" : ""}`);
  const result = await clearCopiedOverrides({ dryRun, tenantId, includeGeneratedDescriptions });

  printCounts(log, "Overrides set BEFORE", result.before);
  printCounts(log, dryRun ? "Would be cleared" : "Cleared", result.cleared);
  printCounts(log, dryRun ? "Overrides set AFTER (projected)" : "Overrides set AFTER", result.after);
  log(`\nDone — ${result.listingsTouched} listing(s) ${dryRun ? "would be updated" : "updated"}.`);
  return result;
}

module.exports = { run };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");

  const dryRun = process.argv.includes("--dry-run");
  const includeGeneratedDescriptions = process.argv.includes("--include-generated-descriptions");
  const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
  const tenantId = tenantArg ? tenantArg.split("=")[1] : null;

  (async () => {
    await mongoose.connect(config.mongoUri);
    console.log(`Connected to MongoDB${dryRun ? " (--dry-run: no writes will be made)" : ""}`);
    await run({ dryRun, tenantId, includeGeneratedDescriptions });
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("backfillClearCopiedOverrides failed:", err);
    process.exit(1);
  });
}
