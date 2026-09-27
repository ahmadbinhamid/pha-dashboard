// scripts/syncIndexes.js
// Applies schema indexes; production has autoIndex off. Drops unlisted ones.
// Usage: [--dry-run]  (lists what would be created/dropped, changes nothing)

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const config = require("../src/config");

const MODELS_DIR = path.join(__dirname, "../src/models");
const SKIP_FILES = new Set(["index.js", "base.model.js"]);

function modelFiles() {
  return fs
    .readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js") && !SKIP_FILES.has(f));
}

async function reportDiff(Model) {
  const { toDrop, toCreate } = await Model.diffIndexes();
  if (!toDrop.length && !toCreate.length) return;
  const create = toCreate.map((spec) => JSON.stringify(spec));
  console.log(`${Model.modelName}: create [${create.join(", ")}] drop [${toDrop.join(", ")}]`);
}

async function applySync(Model) {
  const before = Date.now();
  const dropped = await Model.syncIndexes();
  const note = dropped.length ? ` (dropped stale: ${dropped.join(", ")})` : "";
  console.log(`${Model.modelName}: synced in ${Date.now() - before}ms${note}`);
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB${dryRun ? " (dry run: no changes)" : ""}`);

  for (const file of modelFiles()) {
    const Model = require(path.join(MODELS_DIR, file));
    // Skips helper exports that aren't Mongoose models.
    if (typeof Model.syncIndexes !== "function") continue;
    await (dryRun ? reportDiff(Model) : applySync(Model));
  }

  console.log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("syncIndexes failed:", err);
  process.exit(1);
});
