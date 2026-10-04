// utils/scriptCli.js
// Shared flags and lifecycle for scripts: read-only unless --confirm.

const mongoose = require("mongoose");
const config = require("../config");

/** --dry-run (default) | --confirm, plus an optional --tenant=<ObjectId>. */
function parseScriptArgs(argv = process.argv.slice(2)) {
  const confirm = argv.includes("--confirm");
  if (confirm && argv.includes("--dry-run")) throw new Error("Pass either --dry-run or --confirm, not both.");
  const tenantArg = argv.find((a) => a.startsWith("--tenant="));
  const tenantId = tenantArg ? tenantArg.slice("--tenant=".length) : null;
  if (tenantId !== null && !mongoose.isValidObjectId(tenantId)) throw new Error(`--tenant is not an ObjectId: ${tenantId}`);
  return { confirm, dryRun: !confirm, tenantId };
}

/** Connects, runs main, always disconnects; never rejects (exit code 1). */
async function runScript(main, log = console.log) {
  try {
    const args = parseScriptArgs();
    await mongoose.connect(config.mongoUri);
    log(`== Mode: ${args.confirm ? "CONFIRM (writing)" : "DRY RUN (read-only)"}${args.tenantId ? ` | tenant ${args.tenantId}` : ""}`);
    await main(args, log);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { parseScriptArgs, runScript };
