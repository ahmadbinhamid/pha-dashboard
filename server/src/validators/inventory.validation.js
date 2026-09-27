// validators/inventory.validation.js

const Joi = require("joi");
const { DIGEST_FREQUENCY, DIGEST_MONTH_DAY_MAX } = require("../constants/inventory.constants");
const { ADJUSTMENT_TYPE } = require("../constants/inventory.constants");

const listInventory = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow("").default(""),
    location: Joi.string().allow("").default(""),
    product: Joi.string().allow("").default(""),
    variant: Joi.string().allow("").default(""),
  }),
};

const ensureRecord = {
  body: Joi.object({
    product: Joi.string().required(),
    location: Joi.string().required(),
    variant: Joi.string().allow(null, "").default(null),
  }),
};

const adjustStock = {
  body: Joi.object({
    adjustment: Joi.number().integer().not(0).required().messages({
      "any.required": "Adjustment value is required",
      "number.base": "Adjustment must be a number",
      "number.integer": "Adjustment must be a whole number",
      "any.invalid": "Adjustment cannot be zero",
    }),
    reason: Joi.string().allow("", null).default(null),
    type: Joi.string()
      .valid(...Object.values(ADJUSTMENT_TYPE))
      .default(ADJUSTMENT_TYPE.OTHER),
  }),
};

const setStock = {
  body: Joi.object({
    stock_count: Joi.number().integer().min(0).required().messages({
      "any.required": "stock_count is required",
      "number.min": "stock_count must be 0 or greater",
    }),
    reason: Joi.string().allow("", null).default(null),
  }),
};

const updateSettings = {
  body: Joi.object({
    low_stock_threshold: Joi.number().integer().min(0),
    email_notifications: Joi.boolean(),
    notification_email: Joi.string().email().allow("", null),
    notification_send_time: Joi.string()
      .pattern(/^\d{2}:\d{2}$/)
      .allow(null),
    notification_frequency: Joi.string().valid(...Object.values(DIGEST_FREQUENCY)),
    notification_weekday: Joi.number().integer().min(0).max(6),
    notification_month_day: Joi.number().integer().min(1).max(DIGEST_MONTH_DAY_MAX),
  }),
};

module.exports = { listInventory, adjustStock, setStock, updateSettings, ensureRecord };
