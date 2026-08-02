// services/tenantSettings.service.js

const Tenant = require("../models/Tenant");
const stripeKeysService = require("./stripe/stripe.keys.service");
const smtpKeysService = require("./email/smtp.keys.service");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

async function getTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw httpError("Tenant not found", 404);
  return tenant;
}

async function updateTenantProfile(
  tenantId,
  {
    company_name,
    abn,
    phone,
    email,
    bank_details,
    pickup_location,
    warranty_text,
    legal_disclaimer_text,
    logo_url,
    favicon_url,
    brand_colour,
    accent_colour,
  },
) {
  const tenant = await getTenant(tenantId);

  if (company_name !== undefined) tenant.company_name = company_name;
  if (abn !== undefined) tenant.abn = abn;
  if (phone !== undefined) tenant.phone = phone;
  if (email !== undefined) tenant.email = email;
  if (bank_details !== undefined) tenant.bank_details = bank_details;
  if (pickup_location !== undefined) tenant.pickup_location = pickup_location;
  if (warranty_text !== undefined) tenant.warranty_text = warranty_text;
  if (legal_disclaimer_text !== undefined) tenant.legal_disclaimer_text = legal_disclaimer_text;
  if (logo_url !== undefined) tenant.logo_url = logo_url;
  if (favicon_url !== undefined) tenant.favicon_url = favicon_url;
  if (brand_colour !== undefined) tenant.brand_colour = brand_colour;
  if (accent_colour !== undefined) tenant.accent_colour = accent_colour;

  await tenant.save();
  return tenant;
}

// Shared branding shape consumed by invoicePdf.js and email.service.js —
// the single source of truth for "what does this tenant's business look like
// on a document/email a customer receives," replacing the old hardcoded
// company.constants.js. Never throws on a missing tenant (falls back to
// nulls) since callers use this for best-effort branding, not access control.
async function getCompanyProfile(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  return {
    company_name: tenant?.company_name || null,
    abn: tenant?.abn || null,
    phone: tenant?.phone || null,
    email: tenant?.email || null,
    logo_url: tenant?.logo_url || null,
    bank_details: tenant?.bank_details || {},
    pickup_location: tenant?.pickup_location || {},
    warranty_text: tenant?.warranty_text || null,
    legal_disclaimer_text: tenant?.legal_disclaimer_text || null,
  };
}

// BYOK — thin pass-throughs to stripe.keys.service.js, kept here so the
// controller only ever imports one tenant-settings service, matching every
// other settings section (company profile, branding).
async function updateStripeKeys(tenantId, payload, webhookUrl) {
  return stripeKeysService.updateStripeKeys(tenantId, payload, webhookUrl);
}

async function getStripeStatus(tenantId) {
  return stripeKeysService.getStripeStatus(tenantId);
}

async function updateStripeWebhookSecret(tenantId, webhookSecret) {
  await stripeKeysService.updateWebhookSecret(tenantId, webhookSecret);
  return stripeKeysService.getStripeStatus(tenantId);
}

async function ensureStripeWebhookToken(tenantId) {
  return stripeKeysService.ensureWebhookToken(tenantId);
}

// BYOK — thin pass-throughs to smtp.keys.service.js, same reasoning as the
// Stripe ones above.
async function updateSmtpCredentials(tenantId, payload) {
  return smtpKeysService.updateSmtpCredentials(tenantId, payload);
}

async function getSmtpStatus(tenantId) {
  return smtpKeysService.getSmtpStatus(tenantId);
}

module.exports = {
  getTenant,
  getCompanyProfile,
  updateTenantProfile,
  updateStripeKeys,
  getStripeStatus,
  updateStripeWebhookSecret,
  ensureStripeWebhookToken,
  updateSmtpCredentials,
  getSmtpStatus,
};
