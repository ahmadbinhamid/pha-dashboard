// scripts/normalizeUploadRefs.js
// Stored upload URLs -> file names. [--dry-run | --confirm] [--tenant=<id>]

const { runScript } = require("../src/utils/scriptCli");
const { normalizeStoredUploadRefs } = require("../src/services/upload-ref-migration.service");

void runScript(async ({ dryRun, tenantId }, log) => {
  const counts = await normalizeStoredUploadRefs({
    dryRun,
    tenantId,
    onChange: (model, id, set) => log(`  ${model} ${id}: ${JSON.stringify(set)}`),
  });
  log(`== ${dryRun ? "Would rewrite" : "Rewrote"}: ${counts.tenants} tenant(s), ` +
    `${counts.storefronts} storefront(s), ${counts.users} user(s)`);
  if (dryRun) log("== Re-run with --confirm to write.");
});
