// controllers/pendingReconciliation.controller.js

const {
  listPending,
  acceptReconciliation,
  rejectReconciliation,
} = require("../services/pendingReconciliation.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

exports.getReconciliations = async (req, res) => {
  try {
    const items = await listPending(req.tenantId);
    return success(res, items);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.acceptReconciliation = async (req, res) => {
  try {
    const row = await acceptReconciliation(req.params.id, req.tenantId, req.user?._id);
    if (!row) return notFound(res, "Reconciliation not found");
    return success(res, row, "Reconciliation accepted — local stock updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.rejectReconciliation = async (req, res) => {
  try {
    const row = await rejectReconciliation(req.params.id, req.tenantId, req.user?._id);
    if (!row) return notFound(res, "Reconciliation not found");
    return success(res, row, "Reconciliation rejected — local stock re-pushed to eBay");
  } catch (err) {
    return systemfailure(res, err);
  }
};
