// validators/dashboard.validation.js

const Joi = require("joi");

const getOrderVolume = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(90).default(7),
    // Custom range, an alternative to `days`. .and() requires either both or neither;
    // to >= from stops an inverted range from producing an empty bucket series.
    from: Joi.date().iso(),
    to: Joi.date().iso().min(Joi.ref("from")),
  }).and("from", "to"),
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

const listActivityLog = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid("", "order", "stock").default(""),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    search: Joi.string().trim().max(200).allow(""),
  }),
};

const getActivityAnalytics = {
  query: Joi.object({
    from: Joi.date().iso(),
    to: Joi.date().iso(),
  }),
};

module.exports = {
  getOrderVolume,
  getActivity,
  getCriticalStock,
  listActivityLog,
  getActivityAnalytics,
};
