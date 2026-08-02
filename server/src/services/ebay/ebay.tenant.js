// services/ebay/ebay.tenant.js
//
// eBay integration is multi-tenant — each tenant authorizes our one eBay
// Application and gets their own EbaySettings record (refresh_token,
// marketplace, warehouse address, policies). This resolves the full set of
// {tenant, settings} pairs the poller/worker needs to iterate, and a
// single-tenant lookup by id for request-scoped (webhook, controller) paths.

const Tenant = require("../../models/Tenant");
const { listConfiguredTenants } = require("./ebay.settings.service");

// Every tenant with a usable refresh_token — one poll cycle per entry.
async function getConfiguredTenants() {
  const settingsList = await listConfiguredTenants();
  if (!settingsList.length) return [];

  const tenantIds = settingsList.map((s) => s.tenant_id);
  const tenants = await Tenant.find({ _id: { $in: tenantIds } });
  const tenantById = new Map(tenants.map((t) => [String(t._id), t]));

  return settingsList
    .map((settings) => {
      const tenant = tenantById.get(String(settings.tenant_id));
      return tenant ? { tenant, settings } : null;
    })
    .filter(Boolean);
}

module.exports = { getConfiguredTenants };
