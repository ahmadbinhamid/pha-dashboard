// services/fixtureResidue.service.test.js
// Residue scan matches fixtures, refuses real tenants, dry run writes nothing.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const { cleanFixtureResidue, selectScope, RefusalError, isFixtureSlug, PROTECTED_TENANT_IDS } = require("./fixtureResidue.service");

const REAL = "6a8d5f999ed1e519ab37ad2f";
// Fresh ids are refused for an hour, so these tests look from 2h ahead.
const later = () => new Date(Date.now() + 2 * 60 * 60 * 1000);

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

test("isFixtureSlug accepts each slug shape the suite generates and rejects real ones", () => {
  const hex8 = crypto.randomUUID().slice(0, 8);
  const uuid = crypto.randomUUID();
  const suiteSlugs = [
    `auth-a-${hex8}`, `auth-b-${hex8}`, `auth-x-${hex8}`, `perm-${hex8}`, `role-test-${hex8}`,
    `invite-inv-${hex8}`, `invite-reuse-${hex8}`, `invite-signup-${hex8}`,
    `test-alpha-${hex8}`, `test-beta-${hex8}`, `test-gamma-${hex8}`, `test-mine-${hex8}`, `test-theirs-${hex8}`,
    `notify-best-effort-${uuid}`, `resolver-test-${uuid}`,
  ];
  for (const slug of suiteSlugs) assert.equal(isFixtureSlug(slug), true, slug);
  for (const slug of ["parts-hub-australia", "audit-selftest-1788772777853", "resolver-test", `resolver-test-${hex8}`, "test-shop"]) {
    assert.equal(isFixtureSlug(slug), false, slug);
  }
  assert.ok(PROTECTED_TENANT_IDS.has("6a8d5f999ed1e519ab37ad2f"));
});

test("dry run reports this file's own orphan fixture, refuses the real tenant, writes nothing", async () => {
  const { db } = mongoose.connection;
  const tenantId = fixtureId();
  const { insertedId } = await db.collection("channelconnections").insertOne({ tenant_id: tenantId, platform: `test-residue-${crypto.randomUUID()}`, status: "connected" });
  const counterId = `${tenantId}:residue_test`;
  await db.collection("counters").insertOne({ _id: counterId, seq: 1 });

  // Fresh ids are refused for an hour, so look from 2h ahead.
  const result = await cleanFixtureResidue(db, { now: new Date(Date.now() + 2 * 60 * 60 * 1000) });

  assert.equal(result.deleted, null, "dry run never deletes");
  assert.ok(await db.collection("channelconnections").findOne({ _id: insertedId }), "fixture still present after dry run");
  assert.ok(await db.collection("counters").findOne({ _id: counterId }));
  assert.ok(result.refused.some((r) => r.id === "6a8d5f999ed1e519ab37ad2f" && r.reason === "protected real tenant"));
  assert.ok(result.fixtureTenants.orphan >= 1);
  const connections = result.report.find((r) => r.collection === "channelconnections");
  assert.ok(connections.count >= 1);
  assert.ok(result.report.find((r) => r.collection === "counters").count >= 1);

  // Without the shift, this run's own fresh fixture is refused.
  const now = await cleanFixtureResidue(db);
  assert.ok(now.refused.some((r) => r.id === String(tenantId) && r.reason === "minted outside the fixture window"));
});

test("selectScope: limit is deterministic, a larger limit is a superset, ledger ids keep their slot", () => {
  const fixtureKeys = ["aa", "cc", "ee", "bb", "dd"].map((c) => c.repeat(12));
  const first3 = selectScope({ fixtureKeys, limit: 3 }).fixtureKeys;
  assert.deepEqual(first3, ["aa", "bb", "cc"].map((c) => c.repeat(12)), "sorted by id");
  assert.deepEqual(selectScope({ fixtureKeys, limit: 3 }).fixtureKeys, first3, "same limit, same tenants");
  const first4 = selectScope({ fixtureKeys, limit: 4 }).fixtureKeys;
  assert.ok(first3.every((k) => first4.includes(k)), "larger limit is a superset");

  // Once aa/bb are cleaned they leave the DB but keep their ledger slots.
  const after = selectScope({ fixtureKeys: fixtureKeys.filter((k) => !first3.slice(0, 2).includes(k)), ledgerKeys: first3.slice(0, 2), limit: 3 });
  assert.deepEqual(after.alreadyCleaned, first3.slice(0, 2));
  assert.deepEqual(after.fixtureKeys, [first3[2]], "only one fresh tenant, not three");
});

test("selectScope: flags never widen the set or bypass a refusal", () => {
  const refused = [{ id: REAL, reason: "protected real tenant" }];
  assert.throws(() => selectScope({ fixtureKeys: ["a".repeat(24)], refused, tenantId: REAL }), (err) => err instanceof RefusalError && /protected real tenant/.test(err.message));
  assert.throws(() => selectScope({ fixtureKeys: [], tenantId: "f".repeat(24) }), /not a fixture tenant/);
  const tampered = selectScope({ fixtureKeys: ["b".repeat(24)], ledgerKeys: [REAL], refused, limit: 10 });
  assert.deepEqual(tampered, { fixtureKeys: ["b".repeat(24)], alreadyCleaned: [] }, "a refused id in the ledger is dropped");
});

test("--tenant on the protected real tenant is refused by the real classification", async () => {
  await assert.rejects(cleanFixtureResidue(mongoose.connection.db, { tenantId: REAL }), (err) => err instanceof RefusalError && /protected real tenant/.test(err.message));
  await assert.rejects(cleanFixtureResidue(mongoose.connection.db, { tenantId: new mongoose.Types.ObjectId() }), /refused/);
});

test("--limit reports a partial run covering at most N tenants", async () => {
  const result = await cleanFixtureResidue(mongoose.connection.db, { limit: 2, now: later() });
  assert.equal(result.scope.partial, true);
  assert.ok(result.scope.covered <= 2);
  assert.ok(result.fixtureTenants.total >= result.scope.covered);
  assert.equal(result.deleted, null);
});

test("--confirm scoped to this file's own fixture deletes only it; protected counts unchanged", async () => {
  const { db } = mongoose.connection;
  const tenantId = fixtureId();
  await db.collection("channelconnections").insertOne({ tenant_id: tenantId, platform: `test-residue-${crypto.randomUUID()}`, status: "connected" });
  await db.collection("counters").insertOne({ _id: `${tenantId}:residue_test`, seq: 1 });
  const totalBefore = await db.collection("channelconnections").countDocuments();

  const result = await cleanFixtureResidue(db, { confirm: true, tenantId, now: later() });

  assert.deepEqual(result.scope.tenantIds, [String(tenantId)]);
  assert.equal(result.deleted.channelconnections, 1);
  assert.equal(result.deleted.counters, 1);
  assert.equal(Object.values(result.deleted).reduce((a, b) => a + b, 0), 2, "nothing beyond this fixture");
  assert.equal(await db.collection("channelconnections").countDocuments(), totalBefore - 1);
  assert.deepEqual(result.protectedCheck.changed, [], "protected tenant untouched");
  assert.ok(result.protectedCheck.before[`${REAL}:channelconnections`] >= 1, "the check really counted the real tenant");
});
