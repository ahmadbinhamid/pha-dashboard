// Dev DB only: report (default) or delete (--confirm) test-fixture residue.
// Usage: [--dry-run|--confirm] [--limit=<n>] [--tenant=<id>] [--ledger=<path>]

const fs = require("fs");
const path = require("path");
const { cleanFixtureResidue } = require("../src/services/fixtureResidue.service");

// Ids --confirm deleted, so --limit still picks the same ids once they're gone.
const DEFAULT_LEDGER = path.join(__dirname, "..", ".fixture-residue-ledger.json");

function readLedger(file, dbName) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"))[dbName]?.cleaned ?? [];
}

// NOTE: written before deleting; a failed run just leaves ids still fixtures.
function appendLedger(file, dbName, keys) {
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const cleaned = new Set(all[dbName]?.cleaned ?? []);
  keys.forEach((k) => cleaned.add(k));
  all[dbName] = { cleaned: [...cleaned].sort(), updated_at: new Date().toISOString() };
  fs.writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`);
}

function report(result, { confirm }, log) {
  const { fixtureTenants: t, scope, refused, report: rows, deleted, protectedCheck } = result;
  log(`\n== Mode: ${confirm ? "CONFIRM (deleting)" : "DRY RUN (nothing is deleted)"}`);
  log(`== Fixture tenants: ${t.total} (${t.orphan} orphan ids with no Tenant doc, ${t.fixtureSlug} fixture-slug Tenant docs)`);
  if (scope.partial) {
    const by = scope.tenantId ? `--tenant=${scope.tenantId}` : `--limit=${scope.limit}`;
    log(`== PARTIAL RUN (${by}): covers ${scope.covered} of ${t.total} matching fixture tenants`);
    if (scope.alreadyCleaned.length) log(`   ${scope.alreadyCleaned.length} tenant(s) in this slot already cleaned (ledger): 0 docs left`);
    for (const id of scope.tenantIds) log(`   in scope: ${id}`);
    for (const id of scope.alreadyCleaned) log(`   cleaned:  ${id}`);
  }

  log("\n== Refused (never touched)");
  const byReason = new Map();
  for (const r of refused) byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r]);
  for (const [reason, list] of byReason) {
    log(`  ${String(list.length).padStart(5)}  ${reason}`);
    for (const r of list.slice(0, 5)) log(`         ${r.id}${r.slug ? ` (${r.slug})` : ""}`);
    if (list.length > 5) log(`         … ${list.length - 5} more`);
  }

  log("\n== Matching documents per collection");
  let total = 0;
  let totalDeleted = 0;
  for (const row of rows) {
    total += row.count;
    totalDeleted += deleted?.[row.collection] ?? 0;
    const done = deleted ? `  deleted ${String(deleted[row.collection] ?? 0).padStart(6)}` : "";
    log(`  ${row.collection.padEnd(24)} ${String(row.count).padStart(7)}${done}  sample: ${row.sample.join(", ") || "-"}`);
  }
  log(`  ${"TOTAL".padEnd(24)} ${String(total).padStart(7)}${deleted ? `  deleted ${String(totalDeleted).padStart(6)}` : ""}`);

  if (protectedCheck) {
    log("\n== Protected tenant re-check (same filters as deletion)");
    if (protectedCheck.changed.length) {
      log("  !!! PROTECTED TENANT COUNTS CHANGED !!!");
      protectedCheck.changed.forEach((c) => log(`  ${c}`));
    } else {
      const nonZero = Object.entries(protectedCheck.after).filter(([, n]) => n > 0);
      log(`  unchanged: ${nonZero.map(([k, n]) => `${k.split(":")[1]}=${n}`).join(", ")}`);
    }
  }
  if (!confirm) log("\nNothing was deleted. Re-run with --confirm to delete exactly the documents above.");
}

function parseArgs(argv) {
  const value = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const limitRaw = value("limit");
  const limit = limitRaw == null ? null : Number(limitRaw);
  if (limitRaw != null && !(Number.isInteger(limit) && limit > 0)) throw new Error("--limit must be a positive integer");
  const tenantId = value("tenant") ?? null;
  if (tenantId != null && !/^[0-9a-f]{24}$/.test(tenantId)) throw new Error("--tenant must be a 24-char hex ObjectId");
  return {
    dryRun: argv.includes("--dry-run"),
    confirm: argv.includes("--confirm"),
    limit,
    tenantId,
    ledger: value("ledger") ?? DEFAULT_LEDGER,
  };
}

module.exports = { report, parseArgs, readLedger, appendLedger };

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const mongoose = require("mongoose");
  const config = require("../src/config");

  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (args.dryRun && args.confirm) {
    console.error("Pass either --dry-run or --confirm, not both.");
    process.exit(1);
  }

  (async () => {
    // NOTE: autoIndex/autoCreate off, so a dry run issues no writes at all.
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    const { db } = mongoose.connection;
    console.log(`Connected to ${db.databaseName}`);
    const ledgerKeys = readLedger(args.ledger, db.databaseName);
    const opts = { limit: args.limit, tenantId: args.tenantId, ledgerKeys };

    // Scope is resolved read-only first; confirm then records it and deletes.
    const preview = await cleanFixtureResidue(db, opts);
    if (args.confirm) appendLedger(args.ledger, db.databaseName, preview.scope.tenantIds);
    const result = args.confirm ? await cleanFixtureResidue(db, { ...opts, confirm: true }) : preview;
    // Also records what confirm covered, in case the DB moved since the preview.
    if (args.confirm) appendLedger(args.ledger, db.databaseName, result.scope.tenantIds);
    report(result, { confirm: args.confirm }, console.log);
    await mongoose.disconnect();
    if (result.protectedCheck?.changed.length) {
      console.error("\nFAILED: the protected real tenant's document counts changed during this run.");
      process.exit(3);
    }
  })().catch((err) => {
    console.error(`cleanFixtureResidue ${err.name === "RefusalError" ? "REFUSED" : "failed"}: ${err.message}`);
    process.exit(err.name === "RefusalError" ? 2 : 1);
  });
}
