// services/vehicle-model.service.js
// Hybrid catalog: every read returns shared/global entries plus this tenant's own; every
// write is scoped to the calling tenant so a custom Combobox value never touches the shared catalog.

const VehicleModel = require("../models/VehicleModel");

// tenantId is passed through explicitly at every call site, rather than an easy-to-forget default.
function visibleTo(tenantId) {
  return { $or: [{ tenant_id: null }, { tenant_id: tenantId }] };
}

async function listMakes(tenantId) {
  return VehicleModel.distinct("make", visibleTo(tenantId)).then((makes) => makes.sort());
}

async function listModels(make, tenantId) {
  return VehicleModel.distinct("model", { make, ...visibleTo(tenantId) }).then((models) => models.sort());
}

async function listModelCodes(make, modelName, tenantId) {
  return VehicleModel.find({ make, model: modelName, ...visibleTo(tenantId) })
    .distinct("model_code")
    .then((codes) => codes.sort());
}

// A tenant's own custom entry wins over a same-named global one. Two lookups instead of one
// $or query so precedence is explicit rather than left to Mongo's return order.
async function getYears(make, modelName, modelCode, tenantId) {
  const own = tenantId
    ? await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: tenantId })
    : null;
  const entry = own || (await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: null }));
  if (!entry) return null;
  return { year_from: entry.year_from, year_to: entry.year_to };
}

// Persists a make/model/model_code combination, scoped to tenantId, never the shared catalog.
// year_from is required by the schema, so entries missing it are skipped, not rejected.
async function upsertVehicleModel({ make, model, model_code, year_from, year_to } = {}, tenantId) {
  const trimmedMake = (make || "").trim();
  const trimmedModel = (model || "").trim();
  if (!trimmedMake || !trimmedModel || year_from == null || !tenantId) return null;

  const filter = {
    tenant_id: tenantId,
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

// Same as upsertVehicleModel for a list of fitment rows; individual row failures are swallowed.
async function upsertVehicleModelsFromRows(rows = [], tenantId) {
  await Promise.all(rows.map((row) => upsertVehicleModel(row, tenantId).catch(() => null)));
}

module.exports = {
  listMakes,
  listModels,
  listModelCodes,
  getYears,
  upsertVehicleModel,
  upsertVehicleModelsFromRows,
};
