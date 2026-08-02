// scripts/syncIndexes.js
//
// One-off/idempotent: production disables Mongoose's autoIndex
// (loaders/mongoose.js — autoIndex: config.env !== "production"), so a
// schema change that adds/changes an index (e.g. this session's
// Tenant.stripe_webhook_token, EbaySettings.webhook_token) never takes
// effect in production until this is run explicitly. Safe to re-run any
// time after a deploy that touches model indexes — syncIndexes() is a no-op
// for indexes that already match the schema.
//
// Usage: node scripts/syncIndexes.js

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const config = require("../src/config");

const MODELS_DIR = path.join(__dirname, "../src/models");

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const modelFiles = fs
    .readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".js") && f !== "index.js" && f !== "base.model.js");

  for (const file of modelFiles) {
    const Model = require(path.join(MODELS_DIR, file));
    if (typeof Model.syncIndexes !== "function") continue; // not a Mongoose model export
    const before = Date.now();
    const dropped = await Model.syncIndexes();
    console.log(
      `${Model.modelName}: synced in ${Date.now() - before}ms${dropped.length ? ` (dropped stale: ${dropped.join(", ")})` : ""}`,
    );
  }

  console.log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("syncIndexes failed:", err);
  process.exit(1);
});
