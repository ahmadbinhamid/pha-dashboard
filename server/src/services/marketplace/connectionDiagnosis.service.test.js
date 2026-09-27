// services/marketplace/connectionDiagnosis.service.test.js
// Diagnosis is read-only and never surfaces tokens. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const ChannelConnection = require("../../models/ChannelConnection");
const ChannelSyncLog = require("../../models/ChannelSyncLog");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { encrypt, packCiphertext } = require("../../utils/crypto/tokenCipher");
const { diagnoseChannelConnection, summarizeDiagnosis } = require("./connectionDiagnosis.service");
const { report } = require("../../../scripts/diagnoseChannelConnection");
const { CHANNEL_SYNC_LOG_STATUS } = require("../../constants/channel.constants");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const SECRET_REFRESH = "refresh-secret-do-not-print";
const SECRET_ACCESS = "access-secret-do-not-print";

async function snapshot(tenantId) {
  const [conn, logs, listings] = await Promise.all([
    ChannelConnection.collection.findOne({ tenant_id: tenantId }),
    ChannelSyncLog.collection.find({ tenant_id: tenantId }).toArray(),
    MarketplaceListing.collection.find({ tenant_id: tenantId }).toArray(),
  ]);
  return JSON.stringify({ conn, logs, listings });
}

test("diagnoseChannelConnection: reports a tripped breaker's auth failures without writing or leaking tokens", async () => {
  const tenantId = fixtureId();
  const refreshCt = packCiphertext(encrypt(SECRET_REFRESH));
  const accessCt = packCiphertext(encrypt(SECRET_ACCESS));
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "google", status: "degraded", consecutive_failures: 12,
    last_error: "Request had invalid authentication credentials (401)", last_success_at: null, disabled_at: null,
    access_token_ct: accessCt, refresh_token_ct: refreshCt, token_expires_at: new Date(Date.now() - 3600_000), deleted_at: null,
  });
  const failure = (code, message, minutesAgo) => ({
    tenant_id: tenantId, platform: "google", job_type: "update", entity_type: "MarketplaceListing", entity_id: fixtureId(),
    status: CHANNEL_SYNC_LOG_STATUS.FAILURE, attempt: 1, error_code: code, error_message: message,
    created_at: new Date(Date.now() - minutesAgo * 60_000),
  });
  await ChannelSyncLog.collection.insertMany([
    failure(null, "401 Unauthorized", 3),
    failure(null, "401 Unauthorized", 2),
    failure("INVALID_IMAGE_URL", "image must be https", 1),
  ]);
  await MarketplaceListing.collection.insertMany([
    { tenant_id: tenantId, product: fixtureId(), variant: null, platform: "google", sync_status: "error", deleted_at: null },
    { tenant_id: tenantId, product: fixtureId(), variant: null, platform: "google", sync_status: "error", deleted_at: null },
    { tenant_id: tenantId, product: fixtureId(), variant: null, platform: "google", sync_status: "synced", deleted_at: null },
    { tenant_id: tenantId, product: fixtureId(), variant: null, platform: "google", sync_status: "error", deleted_at: new Date() },
  ]);

  const before = await snapshot(tenantId);
  const d = await diagnoseChannelConnection(tenantId, "google", { recentLimit: 2 });
  const lines = [];
  report(d, (line) => lines.push(line));
  const printed = lines.join("\n");

  assert.equal(await snapshot(tenantId), before, "read-only: nothing about the fixture changed");
  for (const secret of [SECRET_REFRESH, SECRET_ACCESS, refreshCt, accessCt, refreshCt.slice(0, 12), accessCt.slice(0, 12)]) {
    assert.ok(!printed.includes(secret) && !JSON.stringify(d).includes(secret), "no token value or ciphertext, even truncated");
  }

  assert.equal(d.breakerOpen, true);
  assert.deepEqual(d.tokens, { refreshTokenPresent: true, accessTokenPresent: true, tokenExpiresAt: d.tokens.tokenExpiresAt, tokenExpired: true });
  assert.equal(d.failures.total, 3);
  assert.deepEqual(d.failures.byCode.map((r) => [r.code, r.count]), [["(no code)", 2], ["INVALID_IMAGE_URL", 1]]);
  assert.equal(d.failures.recent.length, 2, "recentLimit respected");
  assert.equal(d.failures.recent[0].message, "image must be https", "newest first, full text");
  assert.deepEqual(d.listings, { error: 2, synced: 1 }, "soft-deleted listing excluded");
  assert.match(d.summary, /circuit breaker is OPEN/);
  assert.match(d.summary, /authentication/);
});

test("diagnoseChannelConnection: a tenant with no connection is reported as not connected", async () => {
  const d = await diagnoseChannelConnection(fixtureId(), "google");
  assert.equal(d.connection, null);
  assert.equal(d.tokens, null);
  assert.match(d.summary, /isn't connected/);
});

test("summarizeDiagnosis: an unmet storefront prerequisite reads as config, and the new rule is visible", () => {
  const summary = summarizeDiagnosis({
    platform: "google",
    breakerOpen: true,
    prerequisite: { reason: "storefront_required", message: "Verify a domain under Settings > Domains." },
    connection: { status: "degraded", consecutiveFailures: 10, breakerThreshold: 10, lastError: "No verified default domain for tenant x", disabledAt: null },
    tokens: { refreshTokenPresent: true, accessTokenPresent: true, tokenExpired: false },
    failures: { total: 1, recent: [{ message: "No verified default domain for tenant x", countsTowardBreaker: false }] },
    listings: {},
    syncLogTtlDays: 30,
  });
  assert.match(summary, /unmet channel prerequisite \(storefront_required\), a configuration problem/);
  assert.match(summary, /does NOT count toward the breaker/);
  assert.match(summary, /tripped under the previous rule/);
  assert.doesNotMatch(summary, /refresh token was revoked/);
});
