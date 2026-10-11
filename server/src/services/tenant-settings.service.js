// services/tenant-settings.service.js

const Tenant = require("../models/Tenant");
const { logger } = require("../loaders/logging");
const defaultBrandService = require("./marketplace/default-brand.service");
const stripeKeysService = require("./stripe/stripe.keys.service");
const smtpKeysService = require("./email/smtp.keys.service");
const { buildPaymentBaseUrl } = require("./stripe/stripe.payment.service");
const { PAYMENT_DOMAIN_MODE } = require("../constants/tenant.constants");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

// Previews both modes with the real link builder, not a client-side copy.
function getPaymentLinkPreview(tenant) {
  return {
    default: `${buildPaymentBaseUrl({ payment_domain_mode: PAYMENT_DOMAIN_MODE.DEFAULT })}/pay/:orderId`,
    vendor_slug: `${buildPaymentBaseUrl({ slug: tenant.slug, payment_domain_mode: PAYMENT_DOMAIN_MODE.VENDOR_SLUG })}/pay/:orderId`,
  };
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
    default_brand,
    logo_url,
    favicon_url,
    brand_colour,
    accent_colour,
    payment_domain_mode,
    order_number_prefix,
    invoice_number_prefix,
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
  const nextBrand = default_brand === undefined ? tenant.default_brand : default_brand?.trim() || null;
  const brandChanged = nextBrand !== (tenant.default_brand ?? null);
  tenant.default_brand = nextBrand;
  if (logo_url !== undefined) tenant.logo_url = logo_url;
  if (favicon_url !== undefined) tenant.favicon_url = favicon_url;
  if (brand_colour !== undefined) tenant.brand_colour = brand_colour;
  if (accent_colour !== undefined) tenant.accent_colour = accent_colour;
  if (payment_domain_mode !== undefined) tenant.payment_domain_mode = payment_domain_mode;
  // Affects only orders created after this save; never reformats old ones.
  if (order_number_prefix !== undefined) tenant.order_number_prefix = order_number_prefix || "ORD";
  if (invoice_number_prefix !== undefined) tenant.invoice_number_prefix = invoice_number_prefix || "INV";

  await tenant.save();
  if (brandChanged) await resyncAfterBrandChange(tenantId);
  return tenant;
}

// Best effort: a queue hiccup mustn't fail the settings save.
async function resyncAfterBrandChange(tenantId) {
  try {
    await defaultBrandService.resyncBrandlessListings(tenantId);
  } catch (err) {
    logger.warn(`[tenant-settings] default brand resync failed for ${tenantId}: ${err.message}`);
  }
}

/** The store's default brand, or null when unset (never an invented value). */
async function getDefaultBrand(tenantId) {
  const tenant = await Tenant.findById(tenantId).select("default_brand").lean();
  return tenant?.default_brand?.trim() || null;
}

// Branding for PDFs/emails; nulls on a missing tenant, as it's best effort.
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

// BYOK pass-throughs, so the controller imports one service.
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

// BYOK pass-throughs to smtp.keys.service.js.
async function updateSmtpCredentials(tenantId, payload) {
  return smtpKeysService.updateSmtpCredentials(tenantId, payload);
}

async function getSmtpStatus(tenantId) {
  return smtpKeysService.getSmtpStatus(tenantId);
}

module.exports = {
  getTenant,
  getCompanyProfile,
  getDefaultBrand,
  getPaymentLinkPreview,
  updateTenantProfile,
  updateStripeKeys,
  getStripeStatus,
  updateStripeWebhookSecret,
  ensureStripeWebhookToken,
  updateSmtpCredentials,
  getSmtpStatus,
};
