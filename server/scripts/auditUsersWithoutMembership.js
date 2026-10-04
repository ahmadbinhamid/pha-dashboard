// scripts/auditUsersWithoutMembership.js
// Read-only: users with no active membership. [--dry-run] [--tenant=<id>]

const { runScript } = require("../src/utils/scriptCli");
const { auditUsersWithoutMembership } = require("../src/services/membershipAudit.service");

function report(rows, log) {
  log(`== Users with no ACTIVE membership: ${rows.length}`);
  for (const r of rows) {
    log(`\n  ${r.email}  (user ${r.user_id})`);
    log(`    account role:     ${r.account_role} / status ${r.account_status}`);
    log(`    user.tenant_id:   ${r.tenant_id} ${r.tenant ?? "(tenant missing)"}`);
    const history = r.membership_history.map((m) => `${m.tenant_id}=${m.status}`).join(", ");
    log(`    memberships:      ${history || "none, in any status"}`);
    log(`    invited:          ${r.was_invited ? "yes" : "no"} | original owner: ${r.is_original_owner ? "yes" : "no"}`);
    log(`    created / login:  ${r.created_at?.toISOString?.() ?? "-"} / ${r.last_login_at?.toISOString?.() ?? "not recorded"}`);
    log(`    owner backfill:   ${r.backfill_eligible ? "ELIGIBLE" : `no, ${r.backfill_blocker}`}`);
  }
}

void runScript(async ({ confirm, tenantId }, log) => {
  // NOTE: this audit never writes, so --confirm is accepted and changes nothing.
  if (confirm) log("   (this script is read-only; --confirm has no effect)");
  report(await auditUsersWithoutMembership({ tenantId }), log);
});
