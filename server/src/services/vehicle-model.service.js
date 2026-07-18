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

// Persists a make/model/model_code combination (including ones the user typed
// as a custom value in a Combobox) so it becomes a selectable option in future
// make/model/model-code/year lookups. year_from is required by the schema, so
// entries missing it are skipped rather than rejected — the value still gets
// saved on the product/listing itself, it just won't be added to the catalog.
async function upsertVehicleModel({ make, model, model_code, year_from, year_to } = {}) {
  const trimmedMake = (make || "").trim();
  const trimmedModel = (model || "").trim();
  if (!trimmedMake || !trimmedModel || year_from == null) return null;

  const filter = {
    make: trimmedMake,
    model: trimmedModel,
    model_code: (model_code || "").trim(),
  };

  return VehicleModel.findOneAndUpdate(
    filter,
    { $set: { year_from, year_to: year_to ?? null } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// Same as upsertVehicleModel, but for a list of fitment rows — failures on
// individual rows are swallowed so one bad row can't block the others.
async function upsertVehicleModelsFromRows(rows = []) {
  await Promise.all(rows.map((row) => upsertVehicleModel(row).catch(() => null)));
}

module.exports = {
  listMakes,
  listModels,
  listModelCodes,
  getYears,
  upsertVehicleModel,
  upsertVehicleModelsFromRows,
};
