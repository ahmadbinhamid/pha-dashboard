// services/domain.service.js

const dns = require("dns").promises;
const Domain = require("../models/Domain");
const { logger } = require("../loaders/logging");
const { DOMAIN_STATUS } = require("../constants/domain.constants");

const VERIFICATION_SUBDOMAIN = "_pha-verify";

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// TXT record on a prefix subdomain so it can't clash with the tenant's SPF.
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

// Unset then set, not atomic (no transactions); must be verified first.
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

// Must match this domain's own verification_token, not any TXT record.
async function verifyDomainDns(id, tenantId) {
  const domain = await Domain.findOne({ _id: id, tenant_id: tenantId });
  if (!domain) return null;

  const recordName = getVerificationRecordName(domain.hostname);
  let records = [];
  try {
    records = await dns.resolveTxt(recordName);
  } catch (err) {
    // ENOTFOUND/ENODATA mean no record yet; anything else is logged.
    if (err.code !== "ENOTFOUND" && err.code !== "ENODATA") {
      logger.warn(`[domain.service] DNS lookup error for ${recordName}: ${err.message}`);
    }
  }

  // DNS splits values over 255 chars; join each record's chunks first.
  const found = records.some((chunks) => chunks.join("") === domain.verification_token);

  if (found) {
    domain.status = DOMAIN_STATUS.ACTIVE;
    domain.verified_at = new Date();
    await domain.save();
  }

  return { domain, verified: found, recordName, expectedValue: domain.verification_token };
}

// Active hostnames for CORS; cached per process, briefly stale by design.
const CACHE_TTL_MS = 60_000;
let hostnameCache = { hostnames: [], expiresAt: 0 };

async function getActiveHostnames() {
  if (Date.now() < hostnameCache.expiresAt) return hostnameCache.hostnames;

  const domains = await Domain.find({ status: DOMAIN_STATUS.ACTIVE }).select("hostname").lean();
  hostnameCache = { hostnames: domains.map((d) => d.hostname), expiresAt: Date.now() + CACHE_TTL_MS };
  return hostnameCache.hostnames;
}

// Verified own domain only; the payment-link subdomain doesn't count.
async function hasVerifiedDefaultDomain(tenantId) {
  const domain = await Domain.exists({ tenant_id: tenantId, is_default: true, status: DOMAIN_STATUS.ACTIVE });
  return !!domain;
}

/** Hostname of the tenant's verified default storefront domain, or null. */
async function getDefaultStorefrontHost(tenantId) {
  const domain = await Domain.findOne({ tenant_id: tenantId, is_default: true, status: DOMAIN_STATUS.ACTIVE })
    .select("hostname")
    .lean();
  return domain?.hostname ?? null;
}

module.exports = {
  getDefaultStorefrontHost,
  listDomains,
  createDomain,
  deleteDomain,
  setDefaultDomain,
  verifyDomainDns,
  getActiveHostnames,
  getVerificationRecordName,
  hasVerifiedDefaultDomain,
};
