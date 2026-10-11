// models/Tenant.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  TENANT_STATUS,
  CONNECTION_STATUS,
  PAYMENT_DOMAIN_MODE,
  TENANT_DEFAULT_BRAND_MAX,
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
  // SKU prefix only; order/invoice prefixes differ so a SKU never looks like one.
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  status: {
    type: String,
    enum: Object.values(TENANT_STATUS),
    default: TENANT_STATUS.ACTIVE,
  },

  // Snapshotted per order at creation, so a change never relabels past orders.
  order_number_prefix: { type: String, default: "ORD", trim: true, uppercase: true, maxlength: 10 },
  invoice_number_prefix: { type: String, default: "INV", trim: true, uppercase: true, maxlength: 10 },

  // Company profile shown on invoices, emails and the storefront.
  company_name: { type: String, default: null },
  abn: { type: String, default: null },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
  pickup_location: { type: pickupLocationSchema, default: () => ({}) },
  warranty_text: { type: String, default: null },
  // Opt-in brand for brandless products on Meta/Google; null = never invent one.
  default_brand: { type: String, default: null, trim: true, maxlength: TENANT_DEFAULT_BRAND_MAX },
  legal_disclaimer_text: { type: String, default: null },

  // Payment link host; VENDOR_SLUG needs `slug` to be a valid public DNS label.
  payment_domain_mode: {
    type: String,
    enum: Object.values(PAYMENT_DOMAIN_MODE),
    default: PAYMENT_DOMAIN_MODE.DEFAULT,
  },

  // Invoice/storefront/email branding, as URLs from the /attachment endpoint.
  logo_url: { type: String, default: null },
  favicon_url: { type: String, default: null },
  brand_colour: { type: String, default: "#000000" },
  accent_colour: { type: String, default: "#FFFFFF" },

  // Stripe BYOK: secret_key/webhook_secret are encrypted at rest (AES-256-GCM).
  stripe_secret_key_ciphertext: { type: String, default: null, select: false },
  stripe_secret_key_iv: { type: String, default: null, select: false },
  stripe_secret_key_tag: { type: String, default: null, select: false },
  // Not secret — safe to read directly, used to init Stripe.js client-side.
  stripe_publishable_key: { type: String, default: null },

  // NOTE: opaque callback id; partial index, as sparse would collide on nulls.
  stripe_webhook_token: { type: String, default: null },
  stripe_webhook_secret_ciphertext: { type: String, default: null, select: false },
  stripe_webhook_secret_iv: { type: String, default: null, select: false },
  stripe_webhook_secret_tag: { type: String, default: null, select: false },

  stripe_connection_status: {
    type: String,
    enum: Object.values(CONNECTION_STATUS),
    default: CONNECTION_STATUS.NOT_CONNECTED,
  },
  stripe_connected_at: { type: Date, default: null },
  stripe_last_error: { type: String, default: null },

  // Tenant SMTP for order emails; unset falls back, system mail never uses it.
  smtp_host: { type: String, default: null },
  smtp_port: { type: Number, default: null },
  smtp_user: { type: String, default: null },
  smtp_pass_ciphertext: { type: String, default: null, select: false },
  smtp_pass_iv: { type: String, default: null, select: false },
  smtp_pass_tag: { type: String, default: null, select: false },
  // Optional overrides for the "From" header; default to company_name/smtp_user.
  smtp_from_name: { type: String, default: null },
  smtp_from_email: { type: String, default: null },

  smtp_connection_status: {
    type: String,
    enum: Object.values(CONNECTION_STATUS),
    default: CONNECTION_STATUS.NOT_CONNECTED,
  },
  smtp_connected_at: { type: Date, default: null },
  smtp_last_error: { type: String, default: null },
});

tenantSchema.index(
  { stripe_webhook_token: 1 },
  { unique: true, partialFilterExpression: { stripe_webhook_token: { $type: "string" } } },
);

module.exports = model("Tenant", tenantSchema);
