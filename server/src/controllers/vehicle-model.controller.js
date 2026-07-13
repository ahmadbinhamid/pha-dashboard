// controllers/vehicle-model.controller.js

const vehicleModelService = require("../services/vehicle-model.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

exports.getMakes = async (req, res) => {
  try {
    const makes = await vehicleModelService.listMakes();
    return success(res, makes);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getModels = async (req, res) => {
  try {
    const models = await vehicleModelService.listModels(req.query.make);
    return success(res, models);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getModelCodes = async (req, res) => {
  try {
    const codes = await vehicleModelService.listModelCodes(
      req.query.make,
      req.query.model,
    );
    return success(res, codes);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getYears = async (req, res) => {
  try {
    const years = await vehicleModelService.getYears(
      req.query.make,
      req.query.model,
      req.query.model_code,
    );
    if (!years) return notFound(res, "No matching vehicle entry found");
    return success(res, years);
  } catch (err) {
    return systemfailure(res, err);
  }
};
