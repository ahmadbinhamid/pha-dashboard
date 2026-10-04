// services/ebay/ebay.tenant.js
// {tenant, settings} pairs for the eBay pollers; reauth-flagged ones skipped.

const Tenant = require("../../models/Tenant");
const { listConfiguredTenants } = require("./ebay.settings.service");
const { flaggedReauth, flagIfPrerequisiteError } = require("../marketplace/channelPrerequisite.service");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

const PLATFORM = MARKETPLACE_PLATFORM.EBAY;

// Lazy: the adapter pulls in the whole eBay API layer.
const ebayManifest = () => require("../marketplace/adapters/ebay.adapter").manifest;

// Every tenant with a usable refresh_token — one poll cycle per entry.
async function getConfiguredTenants() {
  const settingsList = await listConfiguredTenants();
  if (!settingsList.length) return [];

  const usable = settingsList.filter((settings) => {
    // Skipped until reconnect: a refused token would only be refused again.
    if (!flaggedReauth(settings, ebayManifest())) return true;
    logger.info(`[ebay.tenant] tenant ${settings.tenant_id}: reauthentication required — skipping poll`);
    return false;
  });
  if (!usable.length) return [];

  const tenantIds = usable.map((s) => s.tenant_id);
  const tenants = await Tenant.find({ _id: { $in: tenantIds } });
  const tenantById = new Map(tenants.map((t) => [String(t._id), t]));

  return usable
    .map((settings) => {
      const tenant = tenantById.get(String(settings.tenant_id));
      return tenant ? { tenant, settings } : null;
    })
    .filter(Boolean);
}

/** Flags reauthentication_required for a refused-token poll error, or null. */
function flagIfReauthRequired(tenantId, err) {
  return flagIfPrerequisiteError(tenantId, PLATFORM, ebayManifest(), err);
}

module.exports = { getConfiguredTenants, flagIfReauthRequired };
