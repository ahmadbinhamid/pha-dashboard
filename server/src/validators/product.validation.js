// validators/product.validation.js

const Joi = require("joi");

const createProduct = {
  body: Joi.object({
    title: Joi.string().trim().min(1).required().messages({
      "string.empty": "Title is required",
      "any.required": "Title is required",
    }),
    description: Joi.string().allow("").default(""),
    type: Joi.number().valid(1, 2).default(1),
    status: Joi.number().valid(0, 1).default(0),
    is_published_online: Joi.boolean().default(false),
    price: Joi.number().min(0).default(0),
    compare_price: Joi.number().min(0).allow(null).default(null),
    cost_price: Joi.number().min(0).allow(null).default(null),
    is_taxable: Joi.boolean().default(false),
    is_vat_inclusive: Joi.boolean().default(false),
    vat_rate: Joi.number().min(0).allow(null).default(null),
    sku: Joi.string().allow("", null).default(null),
    barcode: Joi.string().allow("", null).default(null),
    stock_control: Joi.boolean().default(false),
    has_variants: Joi.boolean().default(false),
    brand: Joi.string().allow("", null).default(null),
    attachments: Joi.array().items(Joi.string()).default([]),
    categories: Joi.array().items(Joi.string()).default([]),
    tags: Joi.array().items(Joi.string()).default([]),
    related_products: Joi.array().items(Joi.string()).default([]),
    choices: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          items: Joi.array().items(Joi.string()).default([]),
        }),
      )
      .default([]),
    digital_file: Joi.string().allow("", null).default(null),
  }),
};

const updateProduct = {
  body: Joi.object({
    title: Joi.string().trim().min(1),
    description: Joi.string().allow(""),
    type: Joi.number().valid(1, 2),
    status: Joi.number().valid(0, 1),
    is_published_online: Joi.boolean(),
    price: Joi.number().min(0),
    compare_price: Joi.number().min(0).allow(null),
    cost_price: Joi.number().min(0).allow(null),
    is_taxable: Joi.boolean(),
    is_vat_inclusive: Joi.boolean(),
    vat_rate: Joi.number().min(0).allow(null),
    sku: Joi.string().allow("", null),
    barcode: Joi.string().allow("", null),
    stock_control: Joi.boolean(),
    has_variants: Joi.boolean(),
    brand: Joi.string().allow("", null),
    attachments: Joi.array().items(Joi.string()),
    categories: Joi.array().items(Joi.string()),
    tags: Joi.array().items(Joi.string()),
    related_products: Joi.array().items(Joi.string()),
    choices: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        items: Joi.array().items(Joi.string()).default([]),
      }),
    ),
    digital_file: Joi.string().allow("", null),
  }),
};

const bySlugParam = {
  params: Joi.object({
    slug: Joi.string().required(),
  }),
};

const byIdParam = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

const byVariantParam = {
  params: Joi.object({
    id: Joi.string().required(),
    variantId: Joi.string().required(),
  }),
};

const listProducts = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("").default(""),
    status: Joi.string().valid("0", "1", "").default(""),
    categories: Joi.string().allow("").default(""),
    type: Joi.string().valid("1", "2", "").default(""),
  }),
};

module.exports = {
  createProduct,
  updateProduct,
  bySlugParam,
  byIdParam,
  byVariantParam,
  listProducts,
};
