// services/business-migration.service.js
// One-off: legacy customer company_name text becomes a linked Business.

const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const { resolveBusinessId } = require("./business.service");

// Unlinked customers with a company, grouped case-insensitively per tenant.
function unlinkedCompanyGroups(tenantId) {
  return Customer.collection.aggregate(
    [
      {
        $match: {
          deleted_at: null,
          business_id: null,
          company_name: { $type: "string", $regex: /\S/ },
          ...(tenantId && { tenant_id: new mongoose.Types.ObjectId(tenantId) }),
        },
      },
      { $project: { tenant_id: 1, name: { $trim: { input: "$company_name" } } } },
      {
        $group: {
          _id: { tenant_id: "$tenant_id", key: { $toLower: "$name" } },
          name: { $first: "$name" },
          customer_ids: { $push: "$_id" },
        },
      },
    ],
    { allowDiskUse: true },
  );
}

/** One row per business, links customers only when dryRun is false. */
async function migrateCustomerCompanies({ dryRun, tenantId = null }) {
  const rows = [];
  for await (const group of unlinkedCompanyGroups(tenantId)) {
    const { tenant_id } = group._id;
    if (!dryRun) {
      const businessId = await resolveBusinessId(tenant_id, group.name);
      await Customer.collection.updateMany({ _id: { $in: group.customer_ids } }, { $set: { business_id: businessId } });
    }
    rows.push({
      tenant_id: String(tenant_id),
      name: group.name,
      customers: group.customer_ids.length,
      action: dryRun ? "would link" : "linked",
    });
  }
  return rows;
}

module.exports = { migrateCustomerCompanies };
