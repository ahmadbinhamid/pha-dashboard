// scripts/migrateProductVehicleShape.js
// One-off migration: nest flat vehicle_* fields into a single `vehicle` sub-object,
// drop the removed VAT fields, and backfill condition/authenticity defaults.
// Usage: node scripts/migrateProductVehicleShape.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

async function migrate() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const products = mongoose.connection.db.collection("products");
  const docs = await products.find({}).toArray();
  console.log(`Found ${docs.length} products`);

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          vehicle: {
            make: doc.vehicle_make ?? null,
            model: doc.vehicle_model ?? null,
            model_code: doc.vehicle_model_code ?? null,
            year_from: doc.vehicle_year ?? null,
            year_to: doc.vehicle_year_to ?? null,
          },
          condition: doc.condition ?? "NEW",
          authenticity: doc.authenticity ?? null,
        },
        $unset: {
          vehicle_make: "",
          vehicle_model: "",
          vehicle_model_code: "",
          vehicle_year: "",
          vehicle_year_to: "",
          is_vat_inclusive: "",
          vat_rate: "",
        },
      },
    },
  }));

  if (operations.length > 0) {
    const result = await products.bulkWrite(operations);
    console.log(`Migrated: ${result.modifiedCount} / ${docs.length}`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
