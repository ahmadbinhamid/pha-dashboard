// validators/discount.validation.js

const Joi = require("joi");
const { DISCOUNT_TYPE, DISCOUNT_SCOPE, PROMO_CODE_PATTERN, MAX_ORDER_NUMBER } = require("../constants/discount.constants");

const objectId = Joi.string().hex().length(24);

const promoCode = Joi.string()
  .trim()
  .uppercase()
  .pattern(PROMO_CODE_PATTERN)
  .messages({ "string.pattern.base": "Code must be 3-24 letters, numbers, . - or _" });

// Shape only, cross-field rules (code vs automatic, dates) live in the service.
const discountFields = {
  name: Joi.string().trim().min(1).max(80),
  code: promoCode.allow("", null),
  is_automatic: Joi.boolean(),
  discount_type: Joi.string().valid(...Object.values(DISCOUNT_TYPE)),
  discount_value: Joi.number().min(0).max(100000),
  minimum_order: Joi.number().min(0).max(1000000),
  scope: Joi.string().valid(...Object.values(DISCOUNT_SCOPE)),
  category_ids: Joi.array().items(objectId).max(100),
  starts_at: Joi.date().iso().allow(null),
  ends_at: Joi.date().iso().allow(null),
  usage_limit: Joi.number().integer().min(1).allow(null),
  once_per_customer: Joi.boolean(),
  min_order_number: Joi.number().integer().min(1).max(MAX_ORDER_NUMBER).allow(null),
  max_order_number: Joi.number().integer().min(1).max(MAX_ORDER_NUMBER).allow(null),
  active: Joi.boolean(),
};

const byIdParam = { params: Joi.object({ id: objectId.required() }) };

const createDiscount = {
  body: Joi.object({
    ...discountFields,
    name: discountFields.name.required(),
    discount_type: discountFields.discount_type.required(),
  }),
};

const updateDiscount = { ...byIdParam, body: Joi.object(discountFields).min(1) };

module.exports = { createDiscount, updateDiscount, byIdParam, promoCode, discountFields };
