// scripts/retargetStripeWebhooks.js
// Stores' Stripe webhooks to CLIENT_URL. [--dry-run|--confirm] [--tenant=<id>]

const config = require("../src/config");
const { runScript } = require("../src/utils/scriptCli");
const { retargetWebhookEndpoints } = require("../src/services/stripe/stripe.keys.service");

const LABEL = {
  would_update: "WOULD UPDATE",
  updated: "UPDATED",
  already_current: "already current",
  no_endpoint: "NO ENDPOINT, add it by hand",
  error: "ERROR, fix by hand",
};

void runScript(async ({ dryRun, tenantId }, log) => {
  const baseUrl = config.emailBrand.clientUrl;
  // Live stores' Stripe accounts must never be pointed at a dev host.
  if (!/^https:\/\//.test(baseUrl) || /localhost|127\.0\.0\.1/.test(baseUrl)) {
    throw new Error(`CLIENT_URL must be the public https dashboard URL, got: ${baseUrl}`);
  }
  log(`== Target: ${baseUrl}/api/v1/payment/webhook?wt=<each store's token>`);

  const summary = await retargetWebhookEndpoints({
    baseUrl,
    dryRun,
    tenantId,
    onResult: (r) => {
      const where = r.from && r.to ? `\n      ${r.from}\n   -> ${r.to}` : r.to ? `\n   -> ${r.to}` : "";
      log(`  ${r.tenantName} (${r.tenantId}): ${LABEL[r.status]}${r.error ? `: ${r.error}` : ""}${where}`);
    },
  });
  log(`== Summary: ${JSON.stringify(summary)}`);
  if (dryRun) log("== Re-run with --confirm to update Stripe.");
});
