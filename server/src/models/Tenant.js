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

  // Which host generatePaymentLink/checkout links go out under — see
  // PAYMENT_DOMAIN_MODE. VENDOR_SLUG requires `slug` to double as a public
  // DNS label, which it already is (lowercase, unique, url-safe by convention).
  payment_domain_mode: {
    type: String,
    enum: Object.values(PAYMENT_DOMAIN_MODE),
    default: PAYMENT_DOMAIN_MODE.DEFAULT,
  },

  // Branding — shown on invoices, storefront, and customer emails. Stored as
  // plain URLs (uploaded once via the shared /attachment endpoint, then
  // attached here) rather than duplicating file-handling logic per-tenant.
  logo_url: { type: String, default: null },
  favicon_url: { type: String, default: null },
  brand_colour: { type: String, default: "#000000" },
  accent_colour: { type: String, default: "#FFFFFF" },

  // Stripe BYOK — each tenant supplies their own Stripe account's keys
  // instead of onboarding a connected sub-account under a platform account.
  // secret_key/webhook_secret are encrypted at rest (AES-256-GCM — see
  // utils/crypto/tokenCipher.js), same pattern as EbaySettings.refresh_token;
  // stripe.keys.service.js is the only place that encrypts/decrypts them.
  stripe_secret_key_ciphertext: { type: String, default: null, select: false },
  stripe_secret_key_iv: { type: String, default: null, select: false },
  stripe_secret_key_tag: { type: String, default: null, select: false },
  // Not secret — safe to read directly, used to init Stripe.js client-side.
  stripe_publishable_key: { type: String, default: null },

  // Webhook — an opaque, unguessable identifier (NOT this tenant's real _id)
  // embedded in the query string of the one shared callback URL
  // (/api/v1/payment/webhook?wt=<this>), registered by the tenant in their
  // own Stripe Dashboard. webhook_secret is the signing secret Stripe gives
  // them for that endpoint, encrypted the same way as the API secret key.
  // NOT `sparse: true` — `default: null` means this field is always PRESENT
  // (with value null) on a tenant that hasn't connected Stripe, and sparse
  // only excludes a field that's entirely UNSET. With sparse, two tenants
  // both sitting at the default null collided on this unique index the
  // moment a second tenant was ever created — see the partialFilterExpression
  // index below instead, same fix as Order.external_order_id/Product.sku.
  // Found live: this was never hit before because this system only ever had
  // one real tenant until self-service signup existed.
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

  // Email BYOK — each tenant's own SMTP account, used for customer-facing
  // order emails (order confirmed/shipped/ready-for-pickup/receipt) so those
  // arrive from the tenant's own mailbox instead of the platform's shared
  // sender. Falls back to the platform's SMTP (config.smtp) when unset —
  // see mailer.js — so nothing breaks for a tenant who hasn't configured
  // this yet. Platform-level system email (login OTP, password reset, error
  // alerts) always uses the platform SMTP regardless, never this.
  smtp_host: { type: String, default: null },
  smtp_port: { type: Number, default: null },
  smtp_user: { type: String, default: null },
  smtp_pass_ciphertext: { type: String, default: null, select: false },
  smtp_pass_iv: { type: String, default: null, select: false },
  smtp_pass_tag: { type: String, default: null, select: false },
  // Optional overrides for the "From" header — default to company_name/smtp_user.
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
