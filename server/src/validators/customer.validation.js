// validators/customer.validation.js

const Joi = require("joi");

// Digits plus common phone punctuation (space, dash, parens, leading +) —
// no letters. Not a full number-format check, just keeps out non-numeric junk.
const PHONE_PATTERN = /^[\d\s\-()+]*$/;
const phoneMessages = { "string.pattern.base": "Phone number cannot contain letters" };

const addressSchema = Joi.object({
  address: Joi.string().trim().min(1).required(),
  suburb: Joi.string().trim().min(1).required(),
  state: Joi.string().trim().min(1).required(),
  postcode: Joi.string().trim().min(1).required(),
});

const createCustomer = {
  body: Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      "string.empty": "Customer name is required",
      "any.required": "Customer name is required",
    }),
    company_name: Joi.string().trim().allow("", null).default(null),
    email: Joi.string().trim().lowercase().email().allow("", null).default(null),
    phone: Joi.string().trim().allow("", null).pattern(PHONE_PATTERN).messages(phoneMessages).default(null),
    has_online_account: Joi.boolean().default(false),
    shipping_address: addressSchema.allow(null).default(null),
    billing_address: addressSchema.allow(null).default(null),
  }),
};

const updateCustomer = {
  body: Joi.object({
    name: Joi.string().trim().min(1),
    company_name: Joi.string().trim().allow("", null),
    email: Joi.string().trim().lowercase().email().allow("", null),
    phone: Joi.string().trim().allow("", null).pattern(PHONE_PATTERN).messages(phoneMessages),
    has_online_account: Joi.boolean(),
    shipping_address: addressSchema.allow(null),
    billing_address: addressSchema.allow(null),
  }),
};

const byIdParam = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

const listCustomers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("").default(""),
  }),
};

module.exports = { createCustomer, updateCustomer, byIdParam, listCustomers };
