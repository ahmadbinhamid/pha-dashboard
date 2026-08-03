// validators/product.validation.js

const Joi = require("joi");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
  PRODUCT_SORT,
  STOCK_STATUS,
} = require("../constants/product.constants");

const createProduct = {
  body: Joi.object({
    title: Joi.string().trim().min(1).required().messages({
      "string.empty": "Title is required",
      "any.required": "Title is required",
    }),
    description: Joi.string().allow("").default(""),
    type: Joi.string()
      .valid(...Object.values(PRODUCT_TYPE))
      .default(PRODUCT_TYPE.PHYSICAL),
    status: Joi.string()
      .valid(...Object.values(PRODUCT_STATUS))
      .default(PRODUCT_STATUS.DRAFT),
    is_published_online: Joi.boolean().default(false),
    price: Joi.number().min(0).default(0),
    compare_price: Joi.number().min(0).allow(null).default(null),
    cost_price: Joi.number().min(0).allow(null).default(null),
    is_taxable: Joi.boolean().default(false),
    sku: Joi.string().allow("", null).default(null),
    barcode: Joi.string().allow("", null).default(null),
    stock_control: Joi.boolean().default(true),
    has_variants: Joi.boolean().default(false),
    brand: Joi.string().allow("", null).default(null),
    condition: Joi.string()
      .valid(...Object.values(PRODUCT_CONDITION))
      .default(PRODUCT_CONDITION.NEW),
    authenticity: Joi.string()
      .valid(...Object.values(PRODUCT_AUTHENTICITY))
      .allow("", null)
      .default(null),
    // Sent as a JSON-stringified object: { make, model, model_code, year_from, year_to }
    vehicle: Joi.string().allow("", null).default(null),
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
    stock_entries: Joi.string().allow("", null).default(null),
  }),
};

const updateProduct = {
  body: Joi.object({
    title: Joi.string().trim().min(1),
    description: Joi.string().allow(""),
    type: Joi.string().valid(...Object.values(PRODUCT_TYPE)),
    status: Joi.string().valid(...Object.values(PRODUCT_STATUS)),
    is_published_online: Joi.boolean(),
    price: Joi.number().min(0),
    compare_price: Joi.number().min(0).allow(null),
    cost_price: Joi.number().min(0).allow(null),
    is_taxable: Joi.boolean(),
    sku: Joi.string().allow("", null),
    barcode: Joi.string().allow("", null),
    stock_control: Joi.boolean(),
    has_variants: Joi.boolean(),
    brand: Joi.string().allow("", null),
    condition: Joi.string().valid(...Object.values(PRODUCT_CONDITION)),
    authenticity: Joi.string()
      .valid(...Object.values(PRODUCT_AUTHENTICITY))
      .allow("", null),
    vehicle: Joi.string().allow("", null),
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
    status: Joi.string()
      .valid(...Object.values(PRODUCT_STATUS), "")
      .default(""),
    categories: Joi.alternatives()
      .try(Joi.string().allow(""), Joi.array().items(Joi.string()))
      .default(""),
    type: Joi.string()
      .valid(...Object.values(PRODUCT_TYPE), "")
      .default(""),
    price_min: Joi.number().min(0),
    price_max: Joi.number().min(0),
    make: Joi.string().allow("").default(""),
    model: Joi.string().allow("").default(""),
    model_code: Joi.string().allow("").default(""),
    year: Joi.number().integer(),
    sort: Joi.string()
      .valid(...Object.values(PRODUCT_SORT), "")
      .default(""),
    stock: Joi.string()
      .valid(STOCK_STATUS.IN_STOCK, STOCK_STATUS.LOW_STOCK, STOCK_STATUS.OUT_OF_STOCK, "")
      .default(""),
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

const addProductNote = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({
    text: Joi.string().trim().min(1).required().messages({
      "string.empty": "Note text is required",
      "any.required": "Note text is required",
    }),
  }),
};

module.exports = {
  createProduct,
  updateProduct,
  bySlugParam,
  byIdParam,
  byVariantParam,
  listProducts,
  addProductNote,
};
