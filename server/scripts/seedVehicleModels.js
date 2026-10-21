// scripts/seedVehicleModels.js
// Seeds the shared make/model/year fitment catalog; dry run unless --confirm.

const { runScript } = require("../src/utils/scriptCli");
const {
  seedGlobalVehicleModels,
  countGlobalVehicleModels,
} = require("../src/services/vehicle-model.service");
const VEHICLE_DATA = require("./data/vehicle-models.json");

void runScript(async ({ confirm }, log) => {
  const existing = await countGlobalVehicleModels();
  log(`Shared catalog: ${existing} entries; seed file: ${VEHICLE_DATA.length}`);
  if (!confirm) return log("Dry run: re-run with --confirm to upsert.");

  const { inserted, updated } = await seedGlobalVehicleModels(VEHICLE_DATA);
  log(`Done. Inserted: ${inserted}, Updated: ${updated}`);
});
