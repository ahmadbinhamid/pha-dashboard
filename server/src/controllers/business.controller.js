// controllers/business.controller.js

const businessService = require("../services/business.service");
const representativeService = require("../services/representative.service");
const { success, created, notFound, requestConflict, requestfailure, systemfailure } = require("../utils/http/response");

const DUPLICATE_NAME_MESSAGE = "A business with this name already exists";
const DUPLICATE_REP_MESSAGE = "Email already in use. Only reps of the same business can share one.";

// A taken business name and a duplicate rep both surface as code 11000.
function conflictMessage(err) {
  return err.keyPattern?.business_id || err.writeErrors ? DUPLICATE_REP_MESSAGE : DUPLICATE_NAME_MESSAGE;
}

exports.getBusinessOptions = async (req, res) => {
  try {
    return success(res, await businessService.listBusinessOptions(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getBusinesses = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const { items, total } = await representativeService.listBusinesses(
      { skip, limit, search: req.query.search },
      req.tenantId,
    );
    return success(res, { items, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getBusiness = async (req, res) => {
  try {
    const business = await representativeService.getBusinessWithRepresentatives(req.params.id, req.tenantId);
    if (!business) return notFound(res, "Business not found");
    return success(res, business);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createBusiness = async (req, res) => {
  try {
    const business = await representativeService.createBusinessWithRepresentatives(req.tenantId, req.body);
    return created(res, business, "Business created");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, conflictMessage(err));
    return systemfailure(res, err);
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const business = await businessService.renameBusiness(req.params.id, req.tenantId, req.body.name);
    if (!business) return notFound(res, "Business not found");
    return success(res, business, "Business updated");
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, DUPLICATE_NAME_MESSAGE);
    return systemfailure(res, err);
  }
};

exports.deleteBusiness = async (req, res) => {
  try {
    const business = await representativeService.deleteBusiness(req.params.id, req.tenantId);
    if (!business) return notFound(res, "Business not found");
    return success(res, null, "Business deleted");
  } catch (err) {
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};
