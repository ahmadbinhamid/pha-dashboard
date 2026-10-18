// validators/business.validation.js

const Joi = require("joi");
const { PHONE_PATTERN, phoneMessages } = require("./customer.validation");

const nameField = Joi.string().trim().min(1).max(200).messages({
  "string.empty": "Business name is required",
  "any.required": "Business name is required",
});

const representativeSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    "string.empty": "Representative name is required",
    "any.required": "Representative name is required",
  }),
  email: Joi.string().trim().lowercase().email().allow("", null).default(null),
  phone: Joi.string().trim().allow("", null).pattern(PHONE_PATTERN).messages(phoneMessages).default(null),
});

// Same rule as the DB index: one name+email pair per business, case aside.
const repKey = (rep) => (rep.email ? `${rep.name.toLowerCase()}|${rep.email}` : null);
function noDuplicateReps(reps, helpers) {
  const keys = reps.map(repKey).filter(Boolean);
  if (new Set(keys).size !== keys.length) return helpers.message("Each representative must have a different name or email");
  return reps;
}

const createBusiness = {
  body: Joi.object({
    name: nameField.required(),
    representatives: Joi.array().items(representativeSchema).max(50).default([]).custom(noDuplicateReps),
  }),
};

const updateBusiness = {
  body: Joi.object({ name: nameField.required() }),
};

const byIdParam = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

const listBusinesses = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("").default(""),
  }),
};

module.exports = { createBusiness, updateBusiness, byIdParam, listBusinesses };
