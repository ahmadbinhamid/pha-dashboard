// validators/category.validation.js

const Joi = require("joi");

const createCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      "string.empty": "Category name is required",
      "any.required": "Category name is required",
    }),
    description: Joi.string().allow("").default(""),
    thumbnail: Joi.string().allow("", null).default(null),
    parent: Joi.string().allow("", null).default(null),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1),
    description: Joi.string().allow(""),
    thumbnail: Joi.string().allow("", null),
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

const listCategories = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("").default(""),
  }),
};

module.exports = { createCategory, updateCategory, byIdParam, listCategories };
