// models/Tenant.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  TENANT_STATUS,
  CONNECTION_STATUS,
  PAYMENT_DOMAIN_MODE,
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
  // SKU prefix only. Not used for order/invoice numbers, which have their own dedicated prefixes
  // below, split out so a SKU and an order number can never look identical.
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  status: {
    type: String,
    enum: Object.values(TENANT_STATUS),
    default: TENANT_STATUS.ACTIVE,
  },

  // Current setting only, read once at order creation and snapshotted onto the order; never
  // used to reformat an existing order, which would otherwise relabel every past order on change.
  order_number_prefix: { type: String, default: "ORD", trim: true, uppercase: true, maxlength: 10 },
  invoice_number_prefix: { type: String, default: "INV", trim: true, uppercase: true, maxlength: 10 },

  // Company profile — replaces the old hardcoded constants/company.constants.js.
  company_name: { type: String, default: null },
  abn: { type: String, default: null },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
  pickup_location: { type: pickupLocationSchema, default: () => ({}) },
  warranty_text: { type: String, default: null },
  legal_disclaimer_text: { type: String, default: null },

  // Which host payment/checkout links go out under; VENDOR_SLUG requires `slug` to double as a public DNS label.
  payment_domain_mode: {
    type: String,
    enum: Object.values(PAYMENT_DOMAIN_MODE),
    default: PAYMENT_DOMAIN_MODE.DEFAULT,
  },

  // Branding shown on invoices, storefront, and emails; stored as plain URLs via the shared /attachment endpoint.
  logo_url: { type: String, default: null },
  favicon_url: { type: String, default: null },
  brand_colour: { type: String, default: "#000000" },
  accent_colour: { type: String, default: "#FFFFFF" },

  // Stripe BYOK: each tenant supplies their own keys. secret_key/webhook_secret are encrypted
  // at rest (AES-256-GCM), same pattern as EbaySettings.refresh_token.
  stripe_secret_key_ciphertext: { type: String, default: null, select: false },
  stripe_secret_key_iv: { type: String, default: null, select: false },
  stripe_secret_key_tag: { type: String, default: null, select: false },
  // Not secret — safe to read directly, used to init Stripe.js client-side.
  stripe_publishable_key: { type: String, default: null },

  // Opaque identifier (not the tenant's real _id) embedded in the shared callback URL.
  // Not `sparse: true` — default: null means the field is always present, so sparse would
  // collide two null tenants on the unique index; use partialFilterExpression instead. Found live.
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

  // Email BYOK: each tenant's own SMTP for customer-facing order emails, falling back to the
  // platform's SMTP when unset. Platform-level system email always uses the platform SMTP, never this.
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
