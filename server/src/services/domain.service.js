// services/domain.service.js

const dns = require("dns").promises;
const Domain = require("../models/Domain");
const { logger } = require("../loaders/logging");
const { DOMAIN_STATUS } = require("../constants/domain.constants");

const VERIFICATION_SUBDOMAIN = "_pha-verify";

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Verification TXT record lives on a subdomain prefix so it never collides with the tenant's own SPF/etc TXT records.
function getVerificationRecordName(hostname) {
  return `${VERIFICATION_SUBDOMAIN}.${hostname}`;
}

async function listDomains(tenantId) {
  return Domain.find({ tenant_id: tenantId }).sort({ is_default: -1, created_at: -1 });
}

async function createDomain(hostname, tenantId) {
  const normalized = hostname.trim().toLowerCase();

  const existing = await Domain.findOne({ hostname: normalized });
  if (existing) {
    // Deliberately vague about which tenant owns it, to avoid an enumeration leak.
    throw httpError("This domain is already registered", 409);
  }

  return Domain.create({
    tenant_id: tenantId,
    hostname: normalized,
    verification_token: Domain.generateVerificationToken(),
  });
}

async function deleteDomain(id, tenantId) {
  const domain = await Domain.findOne({ _id: id, tenant_id: tenantId });
  if (!domain) return null;
  if (domain.is_default) {
    throw httpError("Cannot delete the default domain — set another domain as default first", 400);
  }
  await domain.softDelete();
  return domain;
}

// Unset then set default (not atomic — no multi-doc transactions, see tenant.service.js); domain must be verified first.
async function setDefaultDomain(id, tenantId) {
  const domain = await Domain.findOne({ _id: id, tenant_id: tenantId });
  if (!domain) return null;
  if (domain.status !== DOMAIN_STATUS.ACTIVE) {
    throw httpError("Only a verified domain can be set as default", 400);
  }

  await Domain.updateMany({ tenant_id: tenantId, is_default: true }, { $set: { is_default: false } });
  domain.is_default = true;
  await domain.save();
  return domain;
}

// Compares the TXT record against this domain's own verification_token, not just any TXT record present.
async function verifyDomainDns(id, tenantId) {
  const domain = await Domain.findOne({ _id: id, tenant_id: tenantId });
  if (!domain) return null;

  const recordName = getVerificationRecordName(domain.hostname);
  let records = [];
  try {
    records = await dns.resolveTxt(recordName);
  } catch (err) {
    // ENOTFOUND/ENODATA = no record yet, not an error; anything else is logged as possible infra trouble.
    if (err.code !== "ENOTFOUND" && err.code !== "ENODATA") {
      logger.warn(`[domain.service] DNS lookup error for ${recordName}: ${err.message}`);
    }
  }

  // resolveTxt returns string[][]; join each record's chunks before comparing (DNS splits values >255 chars).
  const found = records.some((chunks) => chunks.join("") === domain.verification_token);

  if (found) {
    domain.status = DOMAIN_STATUS.ACTIVE;
    domain.verified_at = new Date();
    await domain.save();
  }

  return { domain, verified: found, recordName, expectedValue: domain.verification_token };
}

// All active hostnames across tenants, for CORS (app.js) to accept verified custom domains as Origins.
// Cached in-process for CACHE_TTL_MS to avoid a DB round trip per request; brief staleness is an acceptable trade-off.
const CACHE_TTL_MS = 60_000;
let hostnameCache = { hostnames: [], expiresAt: 0 };

async function getActiveHostnames() {
  if (Date.now() < hostnameCache.expiresAt) return hostnameCache.hostnames;

  const domains = await Domain.find({ status: DOMAIN_STATUS.ACTIVE }).select("hostname").lean();
  hostnameCache = { hostnames: domains.map((d) => d.hostname), expiresAt: Date.now() + CACHE_TTL_MS };
  return hostnameCache.hostnames;
}

// Does this tenant have a real, DNS-verified storefront domain (needed for e.g. Google Merchant Center)?
// Same query as listing.resolver.js#resolveProductUrl's primary branch, but excludes its PAYMENT_LINK_DOMAIN
// fallback — that's a platform subdomain the tenant can't verify with Google, fine for payment links only.
async function hasVerifiedDefaultDomain(tenantId) {
  const domain = await Domain.exists({ tenant_id: tenantId, is_default: true, status: DOMAIN_STATUS.ACTIVE });
  return !!domain;
}

module.exports = {
  listDomains,
  createDomain,
  deleteDomain,
  setDefaultDomain,
  verifyDomainDns,
  getActiveHostnames,
  getVerificationRecordName,
  hasVerifiedDefaultDomain,
};
