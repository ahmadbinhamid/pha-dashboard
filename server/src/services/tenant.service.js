// services/tenant.service.js
//
// Self-service tenant signup — previously the only way to get a new tenant
// into this system was a manual DB insert (or a seed script); there was no
// path for a new business to sign themselves up. This creates a brand-new
// Tenant plus its first user (that tenant's own admin, active immediately —
// there's no other admin on a brand-new tenant to approve them) in one flow.

const Tenant = require("../models/Tenant");
const { createUser } = require("./user.service");
const { generateSlug, ensureUniqueSlug } = require("../utils/slug");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Used by auth.controller.js#login to label each organization a
// multi-tenant account can choose between.
async function findTenantsByIds(ids) {
  return Tenant.find({ _id: { $in: ids } }).select("name slug");
}

// Order/invoice numbers are prefixed with this (e.g. "PHA-00001") — kept
// short and letters-only. Falls back to a fixed prefix for a company name
// with no usable letters (e.g. entirely numeric/symbolic) rather than
// producing an empty code.
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

  // check-then-create races (see utils/slug.js's own comment) are retried
  // below on a genuine unique-index conflict, same pattern used everywhere
  // else in this codebase a slug/code needs to be unique.
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
    return { tenant, user };
  } catch (err) {
    // No DB transaction spans Tenant + User creation (standalone MongoDB,
    // no replica set — see stripe.webhook.service.js's own comment on the
    // same constraint elsewhere in this codebase). A brand-new tenant with
    // no admin user is useless and, left behind, would confusingly occupy
    // its slug/code forever — clean it up rather than orphaning it. Safe:
    // nothing else could have referenced this tenant yet, it was only just
    // created in this same request.
    await Tenant.deleteOne({ _id: tenant._id });
    throw err;
  }
}

module.exports = { registerTenantWithAdmin, findTenantsByIds };
