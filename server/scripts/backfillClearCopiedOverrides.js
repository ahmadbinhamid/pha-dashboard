// Clears listing overrides that just copy the product value; real overrides are kept.
// Usage: [--dry-run] [--tenant=<id>] [--include-generated-descriptions]

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
