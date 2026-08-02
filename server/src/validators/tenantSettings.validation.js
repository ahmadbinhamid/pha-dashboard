// validators/tenantSettings.validation.js

const Joi = require("joi");

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
    legal_disclaimer_text: Joi.string().trim().allow("", null),
    logo_url: Joi.string().trim().uri().allow("", null),
    favicon_url: Joi.string().trim().uri().allow("", null),
    brand_colour: hexColour.allow("", null),
    accent_colour: hexColour.allow("", null),
  }),
};

// secret_key/publishable_key are each optional independently (e.g. update
// just the publishable key without re-entering the secret) — "" clears a
// previously-saved secret key (see stripe.keys.service.js#updateStripeKeys).
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

// Each field is independently optional (e.g. update just the From name
// without re-entering the password) — pass: "" clears previously-saved
// credentials entirely (see smtp.keys.service.js#updateSmtpCredentials).
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
