// scripts/migrateInvoiceNumbers.js
// One-off migration: backfill Order.invoice_number for every order created
// before the field existed, assigning "INV-00001", "INV-00002"... in
// created_at order, then seeds the "invoice_number" Counter so new orders
// continue the sequence without colliding with the backfilled range.
// Usage: node scripts/migrateInvoiceNumbers.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");

async function migrate() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const orders = mongoose.connection.db.collection("orders");
  const counters = mongoose.connection.db.collection("counters");

  const docs = await orders
    .find({ invoice_number: { $exists: false } })
    .sort({ created_at: 1 })
    .toArray();
  console.log(`Found ${docs.length} orders missing invoice_number`);

  if (docs.length > 0) {
    const startingSeq = (await counters.findOne({ _id: "invoice_number" }))?.seq || 0;
    const operations = docs.map((doc, i) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { invoice_number: `INV-${String(startingSeq + i + 1).padStart(5, "0")}` } },
      },
    }));

    const result = await orders.bulkWrite(operations);
    console.log(`Migrated: ${result.modifiedCount} / ${docs.length}`);

    await counters.updateOne(
      { _id: "invoice_number" },
      { $set: { seq: startingSeq + docs.length } },
      { upsert: true },
    );
    console.log(`Counter "invoice_number" now at ${startingSeq + docs.length}`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
