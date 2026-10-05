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
const { objectId, optionalText, formBool, formNumber, formEnum, formJson } = require("./fields");

const fitmentRow = Joi.object({
  make: optionalText(100),
  model: optionalText(100),
  model_code: optionalText(100),
  year_from: Joi.number().integer().min(0).max(9999).allow(null),
  year_to: Joi.number().integer().min(0).max(9999).allow(null),
}).unknown(true);

const packageShape = Joi.object(
  Object.fromEntries(["length", "width", "height", "weight"].map((k) => [k, Joi.number().min(0).allow(null)])),
).unknown(true);

const stockEntry = Joi.object({
  location_id: objectId.allow(null, ""),
  location_name: optionalText(200),
  qty: Joi.number().required(),
}).unknown(true);

const idList = Joi.array().items(Joi.string().max(64)).max(500);

// NOTE: checks multipart strings uncoerced; the controller still parses.
const createProduct = {
  body: Joi.object({
    title: Joi.string().max(500).pattern(/\S/).required().messages({
      "string.empty": "Title is required",
      "string.pattern.base": "Title is required",
      "any.required": "Title is required",
    }),
    description: Joi.string().allow("").max(200_000),
    type: formEnum(Object.values(PRODUCT_TYPE)),
    status: formEnum(Object.values(PRODUCT_STATUS)),
    is_published_online: formBool,
    price: formNumber,
    compare_price: formNumber,
    cost_price: formNumber,
    shipping_cost: formNumber,
    is_taxable: formBool,
    sku: optionalText(100),
    barcode: optionalText(100),
    stock_control: formBool,
    has_variants: formBool,
    brand: optionalText(100),
    mpn: optionalText(100),
    condition: formEnum(Object.values(PRODUCT_CONDITION)),
    authenticity: formEnum(Object.values(PRODUCT_AUTHENTICITY)).allow(null),
    vehicle: formJson(fitmentRow.allow(null)),
    additional_fitments: formJson(Joi.array().items(fitmentRow).max(200)),
    package: formJson(packageShape.allow(null)),
    bay: Joi.string().trim().max(40).allow("", null),
    shipping_method: formEnum(Object.values(SHIPPING_METHOD)),
    tailgate_pickup: formBool,
    tailgate_delivery: formBool,
    // Queue one tag per unit on create (mobile's "Add to Tag Queue").
    add_to_tag_queue: formBool,
    attachments: formJson(idList),
    categories: formJson(idList),
    tags: formJson(Joi.array().items(Joi.string().max(100)).max(100)),
    related_products: formJson(idList),
    choices: formJson(
      Joi.array().items(Joi.object({ name: Joi.string().max(100).required(), items: Joi.array().items(Joi.string().max(100)) }).unknown(true)).max(50),
    ),
    digital_file: optionalText(1000),
    stock_entries: formJson(Joi.array().items(stockEntry).max(200)),
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
