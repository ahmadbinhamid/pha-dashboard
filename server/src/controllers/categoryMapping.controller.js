// controllers/categoryMapping.controller.js
// Thin HTTP layer over services/categoryMapping.service.js.

const categoryMappingService = require("../services/categoryMapping.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

// Service errors carry .status (404 unknown category/platform); anything else is a 500.
function handleError(res, err) {
  if (err.status === 404) return notFound(res, err.message);
  return systemfailure(res, err);
}

exports.getOverview = async (req, res) => {
  try {
    return success(res, await categoryMappingService.getMappingOverview(req.tenantId));
  } catch (err) {
    return handleError(res, err);
  }
};

exports.upsertMapping = async (req, res) => {
  try {
    const { categoryId, platform } = req.params;
    const mapping = await categoryMappingService.upsertMapping(req.tenantId, categoryId, platform, req.body);
    return success(res, mapping, "Category mapping saved");
  } catch (err) {
    return handleError(res, err);
  }
};

exports.deleteMapping = async (req, res) => {
  try {
    const { categoryId, platform } = req.params;
    const deleted = await categoryMappingService.deleteMapping(req.tenantId, categoryId, platform);
    if (!deleted) return notFound(res, "Category mapping not found");
    return success(res, null, "Category mapping removed");
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getForProduct = async (req, res) => {
  try {
    const mapped = await categoryMappingService.getMappedCategoriesForProduct(req.tenantId, req.params.productId);
    if (!mapped) return notFound(res, "Product not found");
    return success(res, mapped);
  } catch (err) {
    return handleError(res, err);
  }
};
