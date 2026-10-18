// controllers/discount.controller.js

const discountService = require("../services/discount.service");
const { success, created, systemfailure } = require("../utils/http/response");

exports.listDiscounts = async (req, res) => {
  try {
    return success(res, await discountService.listDiscounts(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getDiscount = async (req, res) => {
  try {
    return success(res, await discountService.getDiscount(req.params.id, req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createDiscount = async (req, res) => {
  try {
    return created(res, await discountService.createDiscount(req.tenantId, req.body), "Discount created");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateDiscount = async (req, res) => {
  try {
    return success(res, await discountService.updateDiscount(req.params.id, req.tenantId, req.body), "Discount saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteDiscount = async (req, res) => {
  try {
    return success(res, await discountService.deleteDiscount(req.params.id, req.tenantId), "Discount deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

