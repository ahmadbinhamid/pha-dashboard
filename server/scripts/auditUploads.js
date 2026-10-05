// scripts/auditUploads.js
// Read-only: disallowed or mislabelled files. [--dry-run] [--tenant=<id>]

const { runScript } = require("../src/utils/scriptCli");
const { auditUploads } = require("../src/services/uploadAudit.service");

void runScript(async ({ confirm, tenantId }, log) => {
  // NOTE: never deletes; --confirm is accepted and changes nothing.
  if (confirm) log("   (this script is read-only; --confirm has no effect)");
  const { dir, scanned, rows } = await auditUploads({ tenantId });
  log(`== Uploads dir: ${dir}`);
  log(`== Files scanned: ${scanned} | flagged: ${rows.length}`);
  for (const r of rows) {
    log(`\n  ${r.file_name}  (${r.problem})`);
    log(`    size ${r.size} bytes, modified ${r.mtime.toISOString()}`);
    log(r.attachment_id
      ? `    attachment ${r.attachment_id}${r.attachment_deleted ? " (deleted)" : ""}, tenant ${r.tenant_id}, uploaded as "${r.original_name}" (${r.declared_mime})`
      : "    no Attachment document references this file");
  }
});
