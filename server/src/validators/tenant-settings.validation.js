// validators/tenant-settings.validation.js

const Joi = require("joi");
const { TENANT_DEFAULT_BRAND_MAX } = require("../constants/tenant.constants");

const bankDetailsSchema = Joi.object({
  bank_name: Joi.string().trim().allow("", null),
  account_name: Joi.string().trim().allow("", null),
  bsb: Joi.string().trim().allow("", null),
  account_number: Joi.string().trim().allow("", null),
});

const pickupLocationSchema = Joi.object({
  name: Joi.string().trim().allow("", null),
  address: Joi.string().trim().allow("", null),
  country: Joi.string().trim().allow("", null),
  trading_hours: Joi.array().items(Joi.string().trim()),
});

const hexColour = Joi.string().trim().pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

const updateSettings = {
  body: Joi.object({
    company_name: Joi.string().trim().allow("", null),
    abn: Joi.string().trim().allow("", null),
    phone: Joi.string().trim().allow("", null),
    email: Joi.string().trim().lowercase().email().allow("", null),
    bank_details: bankDetailsSchema,
    pickup_location: pickupLocationSchema,
    warranty_text: Joi.string().trim().allow("", null),
    default_brand: Joi.string().trim().max(TENANT_DEFAULT_BRAND_MAX).allow("", null),
    legal_disclaimer_text: Joi.string().trim().allow("", null),
    logo_url: Joi.string().trim().uri().allow("", null),
    favicon_url: Joi.string().trim().uri().allow("", null),
    brand_colour: hexColour.allow("", null),
    accent_colour: hexColour.allow("", null),
    payment_domain_mode: Joi.string().valid("default", "vendor_slug"),
    // Letters/digits only; the "-" is added at format time, never stored.
    order_number_prefix: Joi.string().trim().pattern(/^[A-Za-z0-9]{1,10}$/).allow("", null),
    invoice_number_prefix: Joi.string().trim().pattern(/^[A-Za-z0-9]{1,10}$/).allow("", null),
  }),
};

// Each key is optional; "" clears the saved secret key.
const updateStripeKeys = {
  body: Joi.object({
    secret_key: Joi.string().trim().allow(""),
    publishable_key: Joi.string().trim().allow(""),
  }).min(1),
};

const updateStripeWebhookSecret = {
  body: Joi.object({
    webhook_secret: Joi.string().trim().min(1).required(),
  }),
};

// Each field is optional; pass: "" clears the saved credentials.
const updateSmtpCredentials = {
  body: Joi.object({
    host: Joi.string().trim().allow("", null),
    port: Joi.number().integer().min(1).max(65535).allow(null),
    user: Joi.string().trim().allow("", null),
    pass: Joi.string().allow(""),
    from_name: Joi.string().trim().allow("", null),
    from_email: Joi.string().trim().lowercase().email().allow("", null),
  }).min(1),
};

module.exports = { updateSettings, updateStripeKeys, updateStripeWebhookSecret, updateSmtpCredentials };
