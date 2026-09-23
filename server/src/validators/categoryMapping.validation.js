// validators/categoryMapping.validation.js

const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const mappingParams = {
  params: Joi.object({
    categoryId: objectId.required(),
    platform: Joi.string().trim().required(),
  }),
};

// eBay and Google category ids are both numeric.
const upsertMapping = {
  ...mappingParams,
  body: Joi.object({
    external_category_id: Joi.string().trim().pattern(/^\d+$/).required().messages({
      "string.pattern.base": "Category id must be numeric",
    }),
    external_category_name: Joi.string().trim().allow("", null).default(null),
  }),
};

const productParams = {
  params: Joi.object({ productId: objectId.required() }),
};

module.exports = { mappingParams, upsertMapping, productParams };
