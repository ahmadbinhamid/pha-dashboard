// validators/dashboard.validation.js

const Joi = require("joi");

const getOrderVolume = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(90).default(7),
  }),
};

const getActivity = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),
};

const getCriticalStock = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),
};

module.exports = { getOrderVolume, getActivity, getCriticalStock };
