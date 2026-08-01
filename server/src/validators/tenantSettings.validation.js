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

module.exports = { updateSettings };
