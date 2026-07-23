// validators/category.validation.js

const Joi = require("joi");
const {
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
} = require("../constants/product.constants");

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
    // These mirror product.validation.js's listProducts filters — passing the
    // same active shop filters here makes each category's product_count
    // reflect the current search/vehicle/price/condition selection instead of
    // a static catalog-wide total.
    search: Joi.string().allow("").default(""),
    price_min: Joi.number().min(0),
    price_max: Joi.number().min(0),
    make: Joi.string().allow("").default(""),
    model: Joi.string().allow("").default(""),
    model_code: Joi.string().allow("").default(""),
    year: Joi.number().integer(),
    condition: Joi.string()
      .valid(...Object.values(PRODUCT_CONDITION), "")
      .default(""),
    authenticity: Joi.string()
      .valid(...Object.values(PRODUCT_AUTHENTICITY), "")
      .default(""),
    mpn: Joi.string().allow("").default(""),
    sku: Joi.string().allow("").default(""),
  }),
};

module.exports = { createCategory, updateCategory, byIdParam, listCategories };
