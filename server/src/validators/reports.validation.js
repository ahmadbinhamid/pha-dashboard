// validators/reports.validation.js

const Joi = require("joi");

// Shared by every Reports endpoint — either `days` (last N days ending
// today) or an explicit `from`/`to` pair, same contract as
// dashboard.validation.js#getOrderVolume.
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

// Same contract as every other report — previously `days`-only (and
// min 7 / max 90), which meant the turnover card silently ignored the
// page's date range, and 400'd outright on a range outside that span.
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
