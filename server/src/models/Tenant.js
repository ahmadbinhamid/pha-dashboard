// models/Tenant.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  TENANT_STATUS,
  STRIPE_ONBOARDING_STATUS,
} = require("../constants/tenant.constants");

const bankDetailsSchema = new Schema(
  {
    bank_name: { type: String, default: null },
    account_name: { type: String, default: null },
    bsb: { type: String, default: null },
    account_number: { type: String, default: null },
  },
  { _id: false },
);

const pickupLocationSchema = new Schema(
  {
    name: { type: String, default: null },
    address: { type: String, default: null },
    country: { type: String, default: null },
    trading_hours: { type: [String], default: [] },
  },
  { _id: false },
);

const tenantSchema = buildSchema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  // Short prefix for order/invoice numbers (e.g. "PHA" -> "PHA-00001").
  // Previously hardcoded in order.service.js; now per-tenant.
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  status: {
    type: String,
    enum: Object.values(TENANT_STATUS),
    default: TENANT_STATUS.ACTIVE,
  },

  // Company profile — replaces the old hardcoded constants/company.constants.js
  company_name: { type: String, default: null },
  abn: { type: String, default: null },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
  pickup_location: { type: pickupLocationSchema, default: () => ({}) },
  warranty_text: { type: String, default: null },
  legal_disclaimer_text: { type: String, default: null },

  // Branding — shown on invoices, storefront, and customer emails. Stored as
  // plain URLs (uploaded once via the shared /attachment endpoint, then
  // attached here) rather than duplicating file-handling logic per-tenant.
  logo_url: { type: String, default: null },
  favicon_url: { type: String, default: null },
  brand_colour: { type: String, default: "#000000" },
  accent_colour: { type: String, default: "#FFFFFF" },

  // Stripe Connect
  stripe_account_id: { type: String, default: null },
  stripe_onboarding_status: {
    type: String,
    enum: Object.values(STRIPE_ONBOARDING_STATUS),
    default: STRIPE_ONBOARDING_STATUS.NOT_STARTED,
  },
  stripe_charges_enabled: { type: Boolean, default: false },
  stripe_payouts_enabled: { type: Boolean, default: false },
});

module.exports = model("Tenant", tenantSchema);
