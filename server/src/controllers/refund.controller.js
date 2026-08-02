// controllers/refund.controller.js
//
// Request/response only — all DB access lives in refund.service.js.

const refundService = require("../services/refund.service");
const { success, created, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.getRefundable = async (req, res) => {
  try {
    const summary = await refundService.getRefundableSummary(req.params.id, req.tenantId);
    return success(res, summary);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.listRefunds = async (req, res) => {
  try {
    const refunds = await refundService.listRefundsForOrder(req.params.id, req.tenantId);
    return success(res, refunds);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.createRefund = async (req, res) => {
  try {
    const refund = await refundService.createRefund(req.params.id, req.body, req.user?._id, req.tenantId);
    return created(res, refund);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.voidRefund = async (req, res) => {
  try {
    const refund = await refundService.voidRefund(
      req.params.id,
      { reason: req.body.reason, userId: req.user?._id, force: req.body.force },
      req.tenantId,
    );
    return success(res, refund, "Refund voided");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.retryRestock = async (req, res) => {
  try {
    const { refund, retried } = await refundService.retryRestockForRefund(req.params.id, req.tenantId);
    return success(res, refund, retried > 0 ? `Retried ${retried} line(s)` : "Nothing needed retrying");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};
