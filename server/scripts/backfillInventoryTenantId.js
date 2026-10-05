// scripts/backfillInventoryTenantId.js
// Stock rows take their product's tenant. [--dry-run|--confirm] [--tenant=<id>]

const { runScript } = require("../src/utils/scriptCli");
const { backfillInventoryTenantId } = require("../src/services/inventoryTenantBackfill.service");

void runScript(async ({ confirm, tenantId }, log) => {
  const results = await backfillInventoryTenantId({ tenantId, confirm });
  for (const [collection, r] of Object.entries(results)) {
    log(`\n== ${collection}`);
    log(`   rows without tenant_id: ${r.missing}`);
    log(`   ${confirm ? `updated: ${r.updated}` : `would update: ${r.wouldUpdate}`}`);
    for (const [tenant, count] of Object.entries(r.byTenant)) log(`     tenant ${tenant}: ${count}`);
    log(`   product no longer exists (left untouched): ${r.orphans}`);
    for (const o of r.orphanSample) log(`     ${o._id} -> missing product ${o.product}`);
    if (r.orphans > r.orphanSample.length) log(`     … ${r.orphans - r.orphanSample.length} more`);
  }
});
