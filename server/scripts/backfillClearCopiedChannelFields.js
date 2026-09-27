// Clears listing condition/authenticity/fitment copied from the product.
// Usage: [--dry-run] [--tenant=<id>]

const { clearCopiedChannelFields, FIELDS } = require("../src/services/marketplace/copiedChannelFields.service");

function printCounts(log, label, counts) {
  log(`${label}:`);
  for (const field of FIELDS) log(`  ${field.padEnd(22)} ${counts[field]}`);
}

async function run({ dryRun = false, tenantId = null, log = console.log } = {}) {
  log(`Scope: ${tenantId ? `tenant ${tenantId}` : "all tenants"}`);
  const result = await clearCopiedChannelFields({ dryRun, tenantId });

  printCounts(log, "Set on the listing BEFORE", result.before);
  printCounts(log, dryRun ? "Would be cleared (copies of the product)" : "Cleared (copies of the product)", result.cleared);
  printCounts(log, dryRun ? "Set on the listing AFTER (projected)" : "Set on the listing AFTER", result.after);
  log(`\nAmbiguous, left untouched: ${result.ambiguous.count} eBay listing(s) with condition "NEW" that differs from the product.`);
  log('  "NEW" was the old default, so these may never have been chosen; nothing records which.');
  if (result.ambiguous.sample.length) log(`  sample: ${result.ambiguous.sample.join(", ")}`);
  log(`\nDone — ${result.listingsTouched} listing(s) ${dryRun ? "would be updated" : "updated"}.`);
  return result;
}

module.exports = { run };

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");

  const dryRun = process.argv.includes("--dry-run");
  const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
  const tenantId = tenantArg ? tenantArg.split("=")[1] : null;
  if (tenantId && !mongoose.isValidObjectId(tenantId)) {
    console.error("--tenant must be an ObjectId");
    process.exit(1);
  }

  (async () => {
    // NOTE: autoIndex/autoCreate off, so --dry-run issues no writes at all.
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    console.log(`Connected to MongoDB${dryRun ? " (--dry-run: no writes will be made)" : ""}`);
    await run({ dryRun, tenantId });
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("backfillClearCopiedChannelFields failed:", err);
    process.exit(1);
  });
}
