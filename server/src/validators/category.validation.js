// validators/category.validation.js

const Joi = require("joi");

const createCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      "string.empty": "Category name is required",
      "any.required": "Category name is required",
    }),
    parent: Joi.string().allow("", null).default(null),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1),
    parent: Joi.string().allow("", null),
    sort_order: Joi.number().integer().min(0),
    slug: Joi.string().trim(),
  }),
};

const byIdParam = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

module.exports = { createCategory, updateCategory, byIdParam };
