// services/fixtureResidue.service.js
// Finds test-fixture residue in the dev DB; deletes only on explicit request.

const mongoose = require("mongoose");
const config = require("../config");

// The known real tenant on the dev DB: never a candidate, whatever matches.
const PROTECTED_TENANT_IDS = new Set(["6a8d5f999ed1e519ab37ad2f"]);

// Slugs from Tenant.create in *.test.js: fixed prefix + random suffix.
const HEX8 = "[0-9a-f]{8}";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FIXTURE_SLUG_PATTERNS = [
  new RegExp(`^auth-[abx]-${HEX8}$`),
  new RegExp(`^perm-${HEX8}$`),
  new RegExp(`^role-test-${HEX8}$`),
  new RegExp(`^invite-(inv|reuse|signup)-${HEX8}$`),
  new RegExp(`^test-(alpha|beta|gamma|mine|theirs)-${HEX8}$`),
  new RegExp(`^notify-best-effort-${UUID}$`),
  new RegExp(`^resolver-test-${UUID}$`),
];

// Fixture ids were only minted from this date on; older ids are never touched.
const FIXTURE_EPOCH = new Date("2026-09-01T00:00:00Z");
// Skip ids minted in the last hour: a running suite cleans its own on exit.
const MIN_AGE_MS = 60 * 60 * 1000;

// Records fixtures never leave behind; any of these means "could be real".
const ACTIVITY_COLLECTIONS = ["users", "memberships", "orders", "payments", "invitations"];

const ID_CHUNK = 500;
const SAMPLE_SIZE = 3;

function isFixtureSlug(slug) {
  return typeof slug === "string" && FIXTURE_SLUG_PATTERNS.some((re) => re.test(slug));
}

function inFixtureWindow(id, now) {
  const minted = id.getTimestamp().getTime();
  return minted >= FIXTURE_EPOCH.getTime() && minted <= now.getTime() - MIN_AGE_MS;
}

function chunks(list, size = ID_CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function tenantedCollections(db) {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  const withTenant = [];
  for (const name of names.sort()) {
    if (name === "tenants") continue;
    if (await db.collection(name).findOne({ tenant_id: { $exists: true } }, { projection: { _id: 1 } })) withTenant.push(name);
  }
  return withTenant;
}

const COUNTER_TENANT_KEY = /^([0-9a-f]{24}):/;

// Every referenced tenant_id, including ones left only in counter keys.
async function collectTenantIds(db, collections) {
  const ids = new Map();
  for (const name of collections) {
    for (const id of await db.collection(name).distinct("tenant_id")) {
      if (id instanceof mongoose.Types.ObjectId) ids.set(String(id), id);
    }
  }
  const counters = await db.collection("counters").find({ _id: { $regex: COUNTER_TENANT_KEY } }, { projection: { _id: 1 } }).toArray();
  for (const { _id } of counters) {
    const key = COUNTER_TENANT_KEY.exec(_id)[1];
    if (!ids.has(key)) ids.set(key, new mongoose.Types.ObjectId(key));
  }
  return ids;
}

async function hasActivity(db, ids) {
  const active = new Set();
  for (const name of ACTIVITY_COLLECTIONS) {
    for (const part of chunks(ids)) {
      const found = await db.collection(name).distinct("tenant_id", { tenant_id: { $in: part } });
      found.forEach((id) => active.add(String(id)));
    }
  }
  return active;
}

/** Classifies each tenant id as fixture (deletable) or refused, with why. */
async function findFixtureTenants(db, { now = new Date() } = {}) {
  const collections = await tenantedCollections(db);
  const referenced = await collectTenantIds(db, collections);
  const tenantDocs = await db.collection("tenants").find({}, { projection: { slug: 1, name: 1 } }).toArray();
  const docById = new Map(tenantDocs.map((t) => [String(t._id), t]));
  for (const t of tenantDocs) referenced.set(String(t._id), t._id);

  const candidates = [];
  const refused = [];
  for (const [key, id] of referenced) {
    const doc = docById.get(key);
    const refuse = (reason) => refused.push({ id: key, slug: doc?.slug ?? null, reason });
    if (PROTECTED_TENANT_IDS.has(key)) { refuse("protected real tenant"); continue; }
    if (!inFixtureWindow(id, now)) { refuse("minted outside the fixture window"); continue; }
    if (doc && !isFixtureSlug(doc.slug)) { refuse("tenant slug is not a test-suite fixture pattern"); continue; }
    candidates.push({ id, key, kind: doc ? "fixture-slug" : "orphan" });
  }

  // NOTE: activity check last, batched; fixtures never leave users/orders.
  const active = await hasActivity(db, candidates.map((c) => c.id));
  const fixtures = [];
  for (const c of candidates) {
    if (active.has(c.key)) refused.push({ id: c.key, slug: docById.get(c.key)?.slug ?? null, reason: "has users/orders/payments" });
    else fixtures.push(c);
  }
  return { fixtures, refused, collections };
}

// Per-collection filters, always scoped to fixture ids (never broad).
async function residueFilters(db, fixtures, collections) {
  const ids = fixtures.map((f) => f.id);
  const filters = collections.map((name) => ({ name, filters: chunks(ids).map((part) => ({ tenant_id: { $in: part } })) }));

  const owned = async (name) => {
    const found = [];
    for (const part of chunks(ids)) {
      const docs = await db.collection(name).find({ tenant_id: { $in: part } }, { projection: { _id: 1 } }).toArray();
      found.push(...docs.map((d) => d._id));
    }
    return found;
  };
  const [products, locations] = await Promise.all([owned("products"), owned("locations")]);
  const byOwner = (part) => ({ $or: [{ product: { $in: part } }, { location: { $in: part } }] });
  const ownerIds = [...products, ...locations];
  for (const name of ["inventories", "inventoryhistories"]) {
    filters.push({ name, filters: chunks(ownerIds).map(byOwner) });
  }
  // Counter ids are "<tenantId>:<name>"; anchored to exact tenant prefixes.
  filters.push({
    name: "counters",
    filters: chunks(fixtures.map((f) => f.key), 200).map((part) => ({ _id: { $regex: `^(${part.join("|")}):` } })),
  });
  filters.push({ name: "tenants", filters: chunks(fixtures.filter((f) => f.kind === "fixture-slug").map((f) => f.id)).map((part) => ({ _id: { $in: part } })) });
  return filters;
}

// De-duplicated ids: exact counts, and confirm deletes just these.
async function matchingIds(db, { name, filters }) {
  const ids = new Map();
  for (const filter of filters) {
    for (const { _id } of await db.collection(name).find(filter, { projection: { _id: 1 } }).toArray()) ids.set(String(_id), _id);
  }
  return [...ids.values()];
}

function assertNotProduction() {
  if (config.env === "production" || process.env.APP_ENV === "production") {
    throw new Error("fixtureResidue: refusing to run against a production environment");
  }
}

// A request the safety rules refuse; the script exits non-zero on it.
class RefusalError extends Error {
  constructor(message) {
    super(message);
    this.name = "RefusalError";
  }
}

// Ledger ids keep their slot: a limit repeats, and a larger one is a superset.
function selectScope({ fixtureKeys, ledgerKeys = [], refused = [], limit = null, tenantId = null }) {
  const fixtures = new Set(fixtureKeys);
  // A refused id in the ledger (hand-edited) is dropped, never shown as cleaned.
  const refusedKeys = new Set(refused.map((r) => r.id));
  const ledger = new Set(ledgerKeys.filter((k) => !refusedKeys.has(k)));
  let keys;
  if (tenantId) {
    const key = String(tenantId);
    const refusal = refused.find((r) => r.id === key);
    if (refusal) throw new RefusalError(`--tenant=${key} refused: ${refusal.reason}`);
    if (!fixtures.has(key) && !ledger.has(key)) throw new RefusalError(`--tenant=${key} refused: not a fixture tenant in this database`);
    keys = [key];
  } else {
    // String sort of 24-char hex ids equals ObjectId order.
    keys = [...new Set([...fixtures, ...ledger])].sort();
  }
  if (limit != null) keys = keys.slice(0, limit);
  return {
    fixtureKeys: keys.filter((k) => fixtures.has(k)),
    alreadyCleaned: keys.filter((k) => !fixtures.has(k)),
  };
}

async function matchesFor(db, fixtures, collections) {
  const filters = await residueFilters(db, fixtures, collections);
  const matches = [];
  for (const entry of filters) matches.push({ name: entry.name, ids: await matchingIds(db, entry) });
  return matches;
}

// Same filters as deletion, so it measures what a delete could touch.
async function protectedCounts(db, collections) {
  const counts = {};
  for (const key of PROTECTED_TENANT_IDS) {
    const target = [{ id: new mongoose.Types.ObjectId(key), key, kind: "fixture-slug" }];
    for (const { name, ids } of await matchesFor(db, target, collections)) counts[`${key}:${name}`] = ids.length;
  }
  return counts;
}

function diffCounts(before, after) {
  return Object.keys({ ...before, ...after })
    .filter((k) => before[k] !== after[k])
    .map((k) => `${k}: ${before[k] ?? 0} -> ${after[k] ?? 0}`);
}

/** Dry-run report; confirm deletes exactly what's reported. Idempotent. */
async function cleanFixtureResidue(db, { confirm = false, now = new Date(), limit = null, tenantId = null, ledgerKeys = [] } = {}) {
  assertNotProduction();
  const { fixtures, refused, collections } = await findFixtureTenants(db, { now });
  // NOTE: refusals are checked before any scoping, so flags only ever narrow.
  const scope = selectScope({ fixtureKeys: fixtures.map((f) => f.key), ledgerKeys, refused, limit, tenantId });
  const inScope = new Set(scope.fixtureKeys);
  const selected = fixtures.filter((f) => inScope.has(f.key));

  const matches = await matchesFor(db, selected, collections);
  const report = matches.map(({ name, ids }) => ({ collection: name, count: ids.length, sample: ids.slice(0, SAMPLE_SIZE).map(String) }));

  let deleted = null;
  let protectedCheck = null;
  if (confirm) {
    const before = await protectedCounts(db, collections);
    deleted = {};
    for (const { name, ids } of matches) {
      deleted[name] = 0;
      for (const part of chunks(ids)) deleted[name] += (await db.collection(name).deleteMany({ _id: { $in: part } })).deletedCount;
    }
    const after = await protectedCounts(db, collections);
    protectedCheck = { before, after, changed: diffCounts(before, after) };
  }

  return {
    fixtureTenants: { total: fixtures.length, orphan: fixtures.filter((f) => f.kind === "orphan").length, fixtureSlug: fixtures.filter((f) => f.kind === "fixture-slug").length },
    scope: {
      partial: limit != null || tenantId != null,
      limit,
      tenantId: tenantId ? String(tenantId) : null,
      covered: selected.length,
      alreadyCleaned: scope.alreadyCleaned,
      tenantIds: scope.fixtureKeys,
    },
    refused,
    report,
    deleted,
    protectedCheck,
  };
}

module.exports = {
  cleanFixtureResidue,
  findFixtureTenants,
  selectScope,
  RefusalError,
  isFixtureSlug,
  FIXTURE_SLUG_PATTERNS,
  PROTECTED_TENANT_IDS,
};
