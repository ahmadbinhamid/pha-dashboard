// scripts/backfillOwnerMemberships.js
// Admin membership for legacy owners. [--dry-run|--confirm] [--tenant=<id>]

const { runScript } = require("../src/utils/scriptCli");
const { backfillOwnerMemberships } = require("../src/services/membershipAudit.service");

void runScript(async ({ confirm, tenantId }, log) => {
  const { rows, eligible, created } = await backfillOwnerMemberships({ tenantId, confirm });
  log(`== Users with no ACTIVE membership: ${rows.length} | eligible owners: ${eligible.length}`);
  for (const r of rows) {
    const verdict = r.backfill_eligible ? (confirm ? "CREATED Admin membership" : "would create Admin membership") : `skip: ${r.backfill_blocker}`;
    log(`  ${r.email.padEnd(36)} tenant ${r.tenant_id}  ${verdict}`);
  }
  log(`== ${confirm ? `Created ${created.length}` : `Would create ${eligible.length}`} membership(s)`);
});
