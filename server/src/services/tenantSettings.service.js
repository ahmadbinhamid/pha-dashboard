// services/tenantSettings.service.js

const Tenant = require("../models/Tenant");
const { createConnectedAccount, createAccountSession, getAccountStatus } = require("./stripe/stripe.connect.service");

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

async function connectStripeAccount(tenantId) {
  const tenant = await getTenant(tenantId);
  await createConnectedAccount(tenant);
  return tenant;
}

async function createStripeAccountSession(tenantId) {
  const tenant = await getTenant(tenantId);
  return createAccountSession(tenant);
}

async function getStripeConnectStatus(tenantId) {
  const tenant = await getTenant(tenantId);
  return getAccountStatus(tenant);
}

module.exports = {
  getTenant,
  updateTenantProfile,
  connectStripeAccount,
  createStripeAccountSession,
  getStripeConnectStatus,
};
