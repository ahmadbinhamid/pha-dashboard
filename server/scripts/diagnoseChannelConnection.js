// Read-only connection diagnosis; never writes, retries or prints tokens.
// Usage: --tenant=<id> --platform=<key> [--recent=5]

const { diagnoseChannelConnection } = require("../src/services/marketplace/connectionDiagnosis.service");

const iso = (date) => (date ? new Date(date).toISOString() : "never");

function report(d, log) {
  log(`\n== ${d.platform} connection for tenant ${d.tenantId}`);
  if (!d.connection) {
    log("  (no live ChannelConnection row)");
  } else {
    const c = d.connection;
    log(`  status:               ${c.status}${c.statusReason ? ` (status_reason ${c.statusReason})` : ""}`);
    log(`  consecutive_failures: ${c.consecutiveFailures} (breaker threshold ${c.breakerThreshold})`);
    log(`  breaker open:         ${d.breakerOpen ? "YES" : "no"}`);
    log(`  last_error:           ${c.lastError ?? "(none)"}`);
    log(`  last_success_at:      ${iso(c.lastSuccessAt)}`);
    log(`  disabled_at:          ${c.disabledAt ? iso(c.disabledAt) : "(not set)"}`);
    log(`  connected_at:         ${iso(c.connectedAt)}`);
    log(`  external account:     ${c.externalAccountId ?? "(none)"}`);
    log(`  prerequisites (live): ${d.prerequisite ? `UNMET: ${d.prerequisite.reason}` : "met"}`);

    const t = d.tokens;
    log("\n== Token state (presence only; values are never read)");
    log(`  refresh token present: ${t.refreshTokenPresent ? "yes" : "NO"}`);
    log(`  access token present:  ${t.accessTokenPresent ? "yes" : "no"}`);
    log(`  token_expires_at:      ${t.tokenExpiresAt ? `${iso(t.tokenExpiresAt)} (${t.tokenExpired ? "in the PAST" : "in the future"})` : "(not set)"}`);
  }

  const f = d.failures;
  log(`\n== Sync log failures (retained ${d.syncLogTtlDays} days): ${f.total}`);
  for (const row of f.byCode) log(`  ${String(row.count).padStart(6)}  ${row.code}  (latest ${iso(row.latest)})`);
  log(`  last success log row: ${iso(f.lastSuccessLogAt)} (successes are only logged if CHANNEL_LOG_SUCCESSES is on)`);
  f.recent.forEach((r, i) => {
    log(`\n  -- failure #${i + 1} at ${iso(r.at)} · job ${r.jobType} · attempt ${r.attempt} · code ${r.code ?? "(none)"} · status ${r.status ?? "(none)"} · listing ${r.entityId ?? "(none)"}`);
    log(`  counts toward breaker (current rule): ${r.countsTowardBreaker ? "YES" : "no"}`);
    log(`  ${r.message ?? "(no message)"}`);
  });

  log("\n== Listings by sync_status");
  const entries = Object.entries(d.listings);
  if (!entries.length) log("  (no listings)");
  for (const [status, count] of entries) log(`  ${String(count).padStart(6)}  ${status}`);

  log("\n== Most likely cause");
  log(`  ${d.summary}\n`);
}

module.exports = { report };

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const mongoose = require("mongoose");
  const config = require("../src/config");
  require("../src/models/index");
  // In-memory only: the diagnosis reads each adapter's manifest prerequisites.
  require("../src/services/marketplace/registerAdapters").registerAdapters();

  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const tenant = arg("tenant");
  const platform = arg("platform");
  const recentLimit = Number(arg("recent") ?? 5);
  if (!tenant || !mongoose.isValidObjectId(tenant) || !platform) {
    console.error("Usage: node scripts/diagnoseChannelConnection.js --tenant=<ObjectId> --platform=<key> [--recent=5]");
    process.exit(1);
  }

  (async () => {
    // NOTE: autoIndex/autoCreate off, else connect issues createIndex writes.
    await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false });
    console.log("Connected to MongoDB (read-only diagnostic: no writes are ever made)");
    const diagnosis = await diagnoseChannelConnection(new mongoose.Types.ObjectId(tenant), platform, { recentLimit });
    report(diagnosis, console.log);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("diagnoseChannelConnection failed:", err.message);
    process.exit(1);
  });
}
