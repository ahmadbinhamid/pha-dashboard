// validators/reports.validation.js

const Joi = require("joi");

// Shared by every Reports endpoint: either `days` or an explicit `from`/`to` pair.
const dateRangeQuery = {
  days: Joi.number().integer().min(1).max(90).default(30),
  from: Joi.date().iso(),
  to: Joi.date().iso().min(Joi.ref("from")),
};

const getSummary = {
  query: Joi.object(dateRangeQuery).and("from", "to"),
};

const getRevenueByChannel = {
  query: Joi.object(dateRangeQuery).and("from", "to"),
};

const getTopCategories = {
  query: Joi.object({
    ...dateRangeQuery,
    limit: Joi.number().integer().min(1).max(20).default(6),
  }).and("from", "to"),
};

const getSalesPerformance = {
  query: Joi.object(dateRangeQuery).and("from", "to"),
};

// Previously `days`-only, so the turnover card ignored the page's date range and 400'd outside it.
const getInventoryTurnover = {
  query: Joi.object(dateRangeQuery).and("from", "to"),
};

module.exports = {
  getSummary,
  getRevenueByChannel,
  getTopCategories,
  getSalesPerformance,
  getInventoryTurnover,
};
