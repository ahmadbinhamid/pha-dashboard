// validators/meta.listing.validation.js

const Joi = require("joi");

const createListing = {
  body: Joi.object({
    product: Joi.string().required(),
    variant: Joi.string().allow(null),
    meta_product_category: Joi.string().allow(null, ""),
    gtin: Joi.string().allow(null, ""),
  }),
};

const updateListing = {
  body: Joi.object({
    meta_product_category: Joi.string().allow(null, ""),
    gtin: Joi.string().allow(null, ""),
    title_override: Joi.string().allow(null, ""),
    description_override: Joi.string().allow(null, ""),
    price_override: Joi.number().allow(null),
  }),
};

module.exports = { createListing, updateListing };
