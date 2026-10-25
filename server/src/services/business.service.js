// services/business.service.js

const Business = require("../models/Business");
const { NAME_COLLATION } = require("../models/Business");
const { buildWordSearchOr } = require("../utils/regex");

// Picker options and search-match caps, a tenant's business list stays small.
const BUSINESS_OPTIONS_LIMIT = 500;
const SEARCH_MATCH_LIMIT = 200;

/** Name-sorted options for the business picker. */
async function listBusinessOptions(tenantId) {
  return Business.find({ tenant_id: tenantId })
    .select("name")
    .collation(NAME_COLLATION)
    .sort({ name: 1 })
    .limit(BUSINESS_OPTIONS_LIMIT)
    .lean();
}

/** One page of businesses, name-sorted, optionally filtered by name. */
async function listBusinessesPage({ skip = 0, limit = 20, search = "" } = {}, tenantId) {
  const filter = { tenant_id: tenantId };
  const or = buildWordSearchOr(["name"], search);
  if (or.length) filter.$or = or;
  const [items, total] = await Promise.all([
    Business.find(filter).collation(NAME_COLLATION).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Business.countDocuments(filter),
  ]);
  return { items, total };
}

async function getBusinessById(id, tenantId) {
  return Business.findOne({ _id: id, tenant_id: tenantId }).lean();
}

/** Ids of businesses whose name matches any word of `search`. */
async function findBusinessIdsByName(tenantId, search) {
  const or = buildWordSearchOr(["name"], search);
  if (!or.length) return [];
  const rows = await Business.find({ tenant_id: tenantId, $or: or })
    .select("_id")
    .limit(SEARCH_MATCH_LIMIT)
    .lean();
  return rows.map((b) => b._id);
}

/** Existing business by case-insensitive name, created on first use. */
async function resolveBusinessId(tenantId, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const filter = { tenant_id: tenantId, name: trimmed };
  const upsert = () =>
    Business.findOneAndUpdate(filter, { $setOnInsert: filter }, { upsert: true, new: true, collation: NAME_COLLATION })
      .select("_id")
      .lean();
  try {
    return (await upsert())._id;
  } catch (err) {
    // Two saves racing on one new name: the loser reads the winner's row.
    if (err?.code !== 11000) throw err;
    return (await upsert())._id;
  }
}

/** Throws code 11000 when the name is taken, so callers can answer 409. */
async function createBusiness(tenantId, name, { payment_terms_days = null } = {}) {
  const business = await Business.create({ tenant_id: tenantId, name, payment_terms_days });
  return business.toObject();
}

/** Omitted fields are left as they are; throws 11000 on a taken name. */
async function updateBusiness(id, tenantId, { name, payment_terms_days }) {
  const set = { name };
  if (payment_terms_days !== undefined) set.payment_terms_days = payment_terms_days;
  return Business.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set: set }, { new: true, runValidators: true }).lean();
}

async function softDeleteBusiness(id, tenantId) {
  const business = await Business.findOne({ _id: id, tenant_id: tenantId });
  if (!business) return null;
  await business.softDelete();
  return business;
}

/** Hard delete, only to undo a business created moments ago. */
async function removeBusiness(id) {
  await Business.deleteOne({ _id: id });
}

module.exports = {
  listBusinessOptions,
  listBusinessesPage,
  getBusinessById,
  findBusinessIdsByName,
  resolveBusinessId,
  createBusiness,
  updateBusiness,
  softDeleteBusiness,
  removeBusiness,
};
