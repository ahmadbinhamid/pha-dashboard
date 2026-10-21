// services/vehicle-model.service.js
// Reads: shared catalog + own tenant; writes: calling tenant only.

const VehicleModel = require("../models/VehicleModel");

// tenantId is explicit at every call site; no easy-to-forget default.
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

// Own entry beats a global one; two lookups keep that precedence explicit.
async function getYears(make, modelName, modelCode, tenantId) {
  const own = tenantId
    ? await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: tenantId })
    : null;
  const entry = own || (await VehicleModel.findOne({ make, model: modelName, model_code: modelCode, tenant_id: null }));
  if (!entry) return null;
  return { year_from: entry.year_from, year_to: entry.year_to };
}

// Rows without year_from (schema-required) are skipped, not rejected.
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

// Per-row failures are swallowed so one bad fitment row can't block the rest.
async function upsertVehicleModelsFromRows(rows = [], tenantId) {
  await Promise.all(rows.map((row) => upsertVehicleModel(row, tenantId).catch(() => null)));
}

const SEED_CHUNK_SIZE = 500;

function globalSeedOp({ make, model, model_code = "", year_from, year_to = null }) {
  return {
    updateOne: {
      filter: { tenant_id: null, make, model, model_code },
      update: { $set: { year_from, year_to } },
      upsert: true,
    },
  };
}

/** Upserts shared-catalog (tenant_id: null) entries in chunked bulk writes. */
async function seedGlobalVehicleModels(entries = []) {
  const totals = { inserted: 0, updated: 0 };
  for (let i = 0; i < entries.length; i += SEED_CHUNK_SIZE) {
    const ops = entries.slice(i, i + SEED_CHUNK_SIZE).map(globalSeedOp);
    const res = await VehicleModel.bulkWrite(ops, { ordered: false });
    totals.inserted += res.upsertedCount;
    totals.updated += res.modifiedCount;
  }
  return totals;
}

async function countGlobalVehicleModels() {
  return VehicleModel.countDocuments({ tenant_id: null });
}

module.exports = {
  seedGlobalVehicleModels,
  countGlobalVehicleModels,
  listMakes,
  listModels,
  listModelCodes,
  getYears,
  upsertVehicleModel,
  upsertVehicleModelsFromRows,
};
