// scripts/syncIndexes.js
// Schema indexes vs the DB: reports by default, applies with --confirm.

const fs = require("fs");
const path = require("path");
const { runScript } = require("../src/utils/scriptCli");

const MODELS_DIR = path.join(__dirname, "../src/models");
const SKIP_FILES = new Set(["index.js", "base.model.js"]);

function loadModels() {
  return fs
    .readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".js") && !f.endsWith(".test.js") && !SKIP_FILES.has(f))
    .map((f) => require(path.join(MODELS_DIR, f)))
    // Skips helper exports that aren't Mongoose models.
    .filter((Model) => typeof Model.diffIndexes === "function");
}

// Read-only: diffIndexes only lists both sides.
async function reportDiff(Model, log) {
  const { toCreate, toDrop } = await Model.diffIndexes();
  if (!toCreate.length && !toDrop.length) {
    log(`  ${Model.modelName}: in sync`);
  } else {
    log(`  ${Model.modelName}:`);
    for (const spec of toCreate) log(`    + create ${JSON.stringify(spec)}`);
    for (const name of toDrop) log(`    - drop   ${name}`);
  }
  return { create: toCreate.length, drop: toDrop.length };
}

async function applySync(Model, log) {
  const before = Date.now();
  const dropped = await Model.syncIndexes();
  log(`  ${Model.modelName}: synced in ${Date.now() - before}ms${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
  return { create: 0, drop: dropped.length };
}

void runScript(async ({ confirm, tenantId }, log) => {
  if (tenantId) throw new Error("--tenant doesn't apply: indexes are per collection, not per tenant.");
  const totals = { create: 0, drop: 0 };
  for (const Model of loadModels()) {
    const result = await (confirm ? applySync(Model, log) : reportDiff(Model, log));
    totals.create += result.create;
    totals.drop += result.drop;
  }
  log(confirm
    ? `== Applied. Stale indexes dropped: ${totals.drop}`
    : `== Would create ${totals.create}, drop ${totals.drop}. Re-run with --confirm to apply.`);
});
