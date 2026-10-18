// services/representative.service.js
// A business together with its representatives (customers sharing its id).

const Customer = require("../models/Customer");
const businessService = require("./business.service");
const { httpError } = require("../utils/http/httpError");

const REP_FIELDS = "name email phone created_at";

/** Map of business id to rep count, one aggregate for the whole page. */
async function countRepresentatives(tenantId, businessIds) {
  if (!businessIds.length) return new Map();
  const rows = await Customer.aggregate([
    { $match: { tenant_id: tenantId, business_id: { $in: businessIds } } },
    { $group: { _id: "$business_id", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

async function listBusinesses(params, tenantId) {
  const { items, total } = await businessService.listBusinessesPage(params, tenantId);
  const counts = await countRepresentatives(tenantId, items.map((b) => b._id));
  return {
    items: items.map((b) => ({ ...b, representatives_count: counts.get(String(b._id)) ?? 0 })),
    total,
  };
}

async function getBusinessWithRepresentatives(id, tenantId) {
  const business = await businessService.getBusinessById(id, tenantId);
  if (!business) return null;
  const representatives = await Customer.find({ tenant_id: tenantId, business_id: business._id })
    .select(REP_FIELDS)
    .sort({ created_at: 1, _id: 1 })
    .lean();
  return { ...business, representatives };
}

/** All or nothing: a failed rep insert removes the business and its reps. */
async function createBusinessWithRepresentatives(tenantId, { name, representatives = [] }) {
  const business = await businessService.createBusiness(tenantId, name);
  try {
    await Customer.insertMany(
      representatives.map((rep) => ({
        tenant_id: tenantId,
        business_id: business._id,
        name: rep.name,
        email: rep.email || null,
        phone: rep.phone || null,
      })),
      { ordered: true },
    );
  } catch (err) {
    // NOTE: no transaction so standalone Mongo works, undo by hand instead.
    await Customer.deleteMany({ tenant_id: tenantId, business_id: business._id });
    await businessService.removeBusiness(business._id);
    throw err;
  }
  return getBusinessWithRepresentatives(business._id, tenantId);
}

/** Refuses while reps remain, so no customer is left pointing at it. */
async function deleteBusiness(id, tenantId) {
  const business = await businessService.getBusinessById(id, tenantId);
  if (!business) return null;
  const counts = await countRepresentatives(tenantId, [business._id]);
  if (counts.get(String(business._id))) {
    throw httpError("Remove or move this business's representatives first", 409);
  }
  return businessService.softDeleteBusiness(id, tenantId);
}

module.exports = {
  listBusinesses,
  getBusinessWithRepresentatives,
  createBusinessWithRepresentatives,
  deleteBusiness,
};
