// scripts/backfillBrandFromMake.js
// Brandless non-aftermarket parts get their vehicle make; dry run by default.

const { runScript } = require("../src/utils/scriptCli");
const { registerAdapters } = require("../src/services/marketplace/registerAdapters");
const { backfillBrandFromMake } = require("../src/services/marketplace/brand-backfill.service");
const { BRAND_BACKFILL_OUTCOME: BACKFILL_OUTCOME } = require("../src/constants/product.constants");
const { defaultBrandPlatforms } = require("../src/services/marketplace/default-brand.service");
const channelQueue = require("../src/queues/channel.queue");
const searchQueue = require("../src/queues/search.queue");

const ROWS = [
  [BACKFILL_OUTCOME.SET, null],
  [BACKFILL_OUTCOME.ALREADY_BRANDED, "skipped (already branded)"],
  [BACKFILL_OUTCOME.AFTERMARKET, "skipped (aftermarket)"],
  [BACKFILL_OUTCOME.UNRECOGNISED_AUTHENTICITY, "skipped (unrecognised authenticity)"],
  [BACKFILL_OUTCOME.NO_MAKE, "skipped (no make)"],
];

function printReport(log, report, dryRun) {
  const { counts, samples } = report;
  log(`\n-- Tenant ${report.tenantId}`);
  for (const [outcome, label] of ROWS) {
    const name = label ?? (dryRun ? "would set" : "set");
    const sample = samples[outcome].length ? `  e.g. ${samples[outcome].join(", ")}` : "";
    log(`  ${name.padEnd(36)} ${String(counts[outcome]).padStart(5)}${sample}`);
  }
  if (!dryRun) log(`  written ${report.written}; ${report.resync.listings} listing(s) in ${report.resync.jobs} sync_batch job(s)`);
}

// Bull holds Redis sockets open; close them or the process never exits.
async function closeQueues() {
  await Promise.all([...channelQueue.queues.values()].map((q) => q.close()));
  await searchQueue.searchQueue.close();
}

void runScript(async ({ dryRun, tenantId }, log) => {
  registerAdapters();
  try {
    // A re-run skips branded products, so their resync must be queueable first.
    if (!dryRun) {
      for (const platform of defaultBrandPlatforms()) await channelQueue.assertQueueReachable(platform);
    }
    const reports = await backfillBrandFromMake({ dryRun, tenantId });
    if (!reports.length) log("No products in scope.");
    for (const report of reports) printReport(log, report, dryRun);
    if (dryRun) log("\nDry run: nothing written, nothing queued. Re-run with --confirm to apply.");
  } finally {
    if (!dryRun) await closeQueues();
  }
});
