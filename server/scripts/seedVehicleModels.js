// scripts/seedVehicleModels.js
// Seed vehicle make/model/year fitment data into the database.
// Usage: node scripts/seedVehicleModels.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const VehicleModel = require("../src/models/VehicleModel");
const VEHICLE_DATA = require("./data/vehicle-models.json");

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
  console.log(`Seeding ${VEHICLE_DATA.length} vehicle entries...`);

  const operations = VEHICLE_DATA.map((entry) => ({
    updateOne: {
      filter: {
        make: entry.make,
        model: entry.model,
        model_code: entry.model_code,
      },
      update: { $set: entry },
      upsert: true,
    },
  }));

  const result = await VehicleModel.bulkWrite(operations);

  console.log(
    `\nDone. Inserted: ${result.upsertedCount}, Updated: ${result.modifiedCount}, Unchanged: ${VEHICLE_DATA.length - result.upsertedCount - result.modifiedCount}`,
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
