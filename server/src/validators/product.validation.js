// validators/product.validation.js

const Joi = require("joi");
const { SHIPPING_METHOD } = require("../constants/shipping.constants");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_AUTHENTICITY,
  PRODUCT_SORT,
  STOCK_STATUS,
} = require("../constants/product.constants");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

// Multipart forms send booleans as "true"/"false" strings.
const formBool = Joi.boolean().truthy("true").falsy("false");

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
    // JSON string: { make, model, model_code, year_from, year_to }
    vehicle: Joi.string().allow("", null).default(null),
    additional_fitments: Joi.string().allow("", null),
    // JSON string: { length, width, height, weight }
    package: Joi.string().allow("", null).default(null),
    bay: Joi.string().trim().max(40).allow("", null).default(null),
    shipping_method: Joi.string().valid(...Object.values(SHIPPING_METHOD)).default(SHIPPING_METHOD.STANDARD),
    tailgate_pickup: formBool.default(false),
    tailgate_delivery: formBool.default(false),
    // Queue one tag per unit on create (mobile's "Add to Tag Queue").
    add_to_tag_queue: Joi.boolean().truthy("true").falsy("false").default(false),
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
    additional_fitments: Joi.string().allow("", null),
    package: Joi.string().allow("", null),
    bay: Joi.string().trim().max(40).allow("", null),
    shipping_method: Joi.string().valid(...Object.values(SHIPPING_METHOD)),
    tailgate_pickup: formBool,
    tailgate_delivery: formBool,
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
    ids: Joi.string().max(2600).allow(""),
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
    // "none" = not listed on any channel; otherwise a specific platform.
    channel: Joi.string()
      .valid(...Object.values(MARKETPLACE_PLATFORM), "none", "")
      .default(""),
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

const sendProductEmail = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      "string.empty": "Recipient name is required",
      "any.required": "Recipient name is required",
    }),
    email: Joi.string().trim().lowercase().email().required().messages({
      "string.email": "Enter a valid email address",
      "any.required": "Recipient email is required",
    }),
  }),
};

const suggestProducts = {
  query: Joi.object({
    q: Joi.string().trim().min(1).required(),
    limit: Joi.number().integer().min(1).max(20).default(6),
  }),
};

module.exports = {
  createProduct,
  updateProduct,
  bySlugParam,
  byIdParam,
  byVariantParam,
  listProducts,
  suggestProducts,
  addProductNote,
  sendProductEmail,
};
