// services/vehicle-model.service.js
//
// Hybrid catalog — see VehicleModel.js's schema comment. Every read here
// must return the shared/global entries (tenant_id: null) PLUS this
// tenant's own custom entries, and nothing belonging to any other tenant.
// Every write (upsert) is scoped to the calling tenant — a tenant typing a
// custom value into a Combobox must never add it to (or collide with) the
// shared catalog other tenants see.

const VehicleModel = require("../models/VehicleModel");

// tenantId is required on every read below (even though it can be null/
// undefined for a caller with no tenant context, e.g. an unauthenticated
// request that somehow reached here) — passing it through explicitly makes
// the scoping intentional at every call site rather than an easy-to-forget
// default.
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

// A tenant's own custom entry wins over a same-named global one (override,
// not a collision — see the model's compound unique index, which is keyed
// by tenant_id specifically so both can coexist). Two lookups instead of
// one $or query so that precedence is explicit rather than left to
// whatever order Mongo happens to return matches in.
async function getYears(make, modelName, modelCode, tenantId) {
  const own = tenantId
    ? await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: tenantId })
    : null;
  const entry = own || (await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: null }));
  if (!entry) return null;
  return { year_from: entry.year_from, year_to: entry.year_to };
}

// Persists a make/model/model_code combination (including ones the user typed
// as a custom value in a Combobox) so it becomes a selectable option in future
// make/model/model-code/year lookups — scoped to tenantId, never the shared
// catalog. year_from is required by the schema, so entries missing it are
// skipped rather than rejected — the value still gets saved on the
// product/listing itself, it just won't be added to the catalog.
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

// Same as upsertVehicleModel, but for a list of fitment rows — failures on
// individual rows are swallowed so one bad row can't block the others.
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
