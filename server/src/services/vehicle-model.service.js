// services/vehicle-model.service.js

const VehicleModel = require("../models/VehicleModel");

async function listMakes() {
  return VehicleModel.distinct("make").then((makes) => makes.sort());
}

async function listModels(make) {
  return VehicleModel.distinct("model", { make }).then((models) => models.sort());
}

async function listModelCodes(make, modelName) {
  return VehicleModel.find({ make, model: modelName })
    .distinct("model_code")
    .then((codes) => codes.sort());
}

async function getYears(make, modelName, modelCode) {
  const entry = await VehicleModel.findOne({
    make,
    model: modelName,
    model_code: modelCode,
  });
  if (!entry) return null;
  return { year_from: entry.year_from, year_to: entry.year_to };
}

module.exports = { listMakes, listModels, listModelCodes, getYears };
