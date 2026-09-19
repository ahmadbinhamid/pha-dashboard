// controllers/reports.controller.js

const reportsService = require("../services/reports.service");
const { success, systemfailure } = require("../utils/http/response");

exports.getSummary = async (req, res) => {
  try {
    const { days, from, to } = req.query;
    const summary = await reportsService.getSummary(req.tenantId, { days, from, to });
    return success(res, summary);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getRevenueByChannel = async (req, res) => {
  try {
    const { days, from, to } = req.query;
    const rows = await reportsService.getRevenueByChannel(req.tenantId, { days, from, to });
    return success(res, rows);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getTopCategories = async (req, res) => {
  try {
    const { days, from, to, limit } = req.query;
    const rows = await reportsService.getTopCategories(req.tenantId, { days, from, to }, limit);
    return success(res, rows);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSalesPerformance = async (req, res) => {
  try {
    const { days, from, to } = req.query;
    const rows = await reportsService.getSalesPerformanceByChannel(req.tenantId, { days, from, to });
    return success(res, rows);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getInventoryTurnover = async (req, res) => {
  try {
    const { days, from, to } = req.query;
    const turnover = await reportsService.getInventoryTurnover(req.tenantId, { days, from, to });
    return success(res, turnover);
  } catch (err) {
    return systemfailure(res, err);
  }
};
