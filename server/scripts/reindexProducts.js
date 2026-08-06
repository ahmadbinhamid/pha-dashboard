// scripts/reindexProducts.js
//
// (Re)creates the Typesense `products` collection (if missing) and upserts
// every product across every tenant into it. Run after first deploying
// Typesense search, or any time the index needs a full rebuild (e.g. after
// changing the collection schema).
//
// Usage: node scripts/reindexProducts.js

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Product = require("../src/models/Product");
const { ensureProductsCollection } = require("../src/services/search/product.search.schema");
const { indexProduct } = require("../src/services/search/product.search.service");

const BATCH_SIZE = 200;

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  await ensureProductsCollection();
  console.log("Typesense `products` collection ready");

  const total = await Product.countDocuments({});
  console.log(`Indexing ${total} products...`);

  let indexed = 0;
  let cursor = Product.find({}).cursor();
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    await Promise.all(batch.map((p) => indexProduct(p)));
    indexed += batch.length;
    console.log(`  ${indexed} / ${total}`);
    batch = [];
  };

  for (let product = await cursor.next(); product != null; product = await cursor.next()) {
    batch.push(product);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  await mongoose.disconnect();
  console.log(`\nDone — indexed ${indexed} products.`);
}

run().catch((err) => {
  console.error("reindexProducts failed:", err);
  process.exit(1);
});
