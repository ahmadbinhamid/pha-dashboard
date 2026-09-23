// services/tenant.service.js
// Self-service tenant signup: creates a new Tenant plus its first admin user, active immediately.

const Tenant = require("../models/Tenant");
const { createUser } = require("./user.service");
const { generateSlug, ensureUniqueSlug } = require("../utils/slug");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");
const { seedSystemRoles } = require("./role.service");
const { addMember } = require("./membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Used to label each organization a multi-tenant account can choose between.
async function findTenantsByIds(ids) {
  return Tenant.find({ _id: { $in: ids } }).select("name slug");
}

async function findTenantById(id) {
  return Tenant.findById(id);
}

// email is unique per-tenant, not globally, so join-an-existing-tenant registration resolves the
// tenant by its slug first.
async function findTenantBySlug(slug) {
  return Tenant.findOne({ slug });
}

// Order/invoice number prefix (e.g. "PHA-00001"); falls back to a fixed prefix if no usable letters.
function baseCodeFromCompanyName(companyName) {
  const letters = companyName.toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 4) || "TEN";
}

async function ensureUniqueCode(baseCode) {
  let code = baseCode;
  let counter = 2;
  while (true) {
    const exists = await Tenant.findOne({ code });
    if (!exists) return code;
    code = `${baseCode}${counter}`;
    counter++;
  }
}

async function registerTenantWithAdmin({ company_name, first_name, last_name, email, password }) {
  const baseSlug = generateSlug(company_name);
  if (!baseSlug) throw httpError("Company name must contain at least one letter or number", 400);

  // check-then-create races are retried on a genuine unique-index conflict, same pattern used elsewhere.
  const MAX_ATTEMPTS = 5;
  let tenant;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const slug = await ensureUniqueSlug(Tenant, baseSlug);
    const code = await ensureUniqueCode(baseCodeFromCompanyName(company_name));
    try {
      tenant = await Tenant.create({
        name: company_name,
        slug,
        code,
        company_name,
      });
      break;
    } catch (err) {
      const isSlugOrCodeConflict =
        err.code === 11000 && err.keyPattern && ("slug" in err.keyPattern || "code" in err.keyPattern);
      if (!isSlugOrCodeConflict || attempt === MAX_ATTEMPTS - 1) throw err;
    }
  }

  try {
    const user = await createUser({
      tenant_id: tenant._id,
      first_name,
      last_name,
      email,
      password,
      role: USER_ROLE.ADMIN,
      status: USER_STATUS.ACTIVE,
      verified_at: new Date(),
    });

    // Membership, not User.tenant_id, is what grants access — a tenant whose only user has
    // no membership would be one nobody can administer.
    const roles = await seedSystemRoles(tenant._id);
    await addMember({
      tenantId: tenant._id,
      userId: user._id,
      roleId: roles[SYSTEM_ROLE.SUPER_ADMIN]._id,
    });

    return { tenant, user };
  } catch (err) {
    // No transaction spans Tenant + User creation (standalone MongoDB); clean up the orphaned
    // tenant rather than leave it occupying its slug/code forever. Safe: nothing else references it yet.
    await Tenant.deleteOne({ _id: tenant._id });
    throw err;
  }
}

module.exports = { registerTenantWithAdmin, findTenantsByIds, findTenantById, findTenantBySlug };
