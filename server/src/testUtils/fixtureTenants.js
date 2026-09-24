// testUtils/fixtureTenants.js
// Tracks fixture tenant ids; deletes all their data when the test file ends.

const { after } = require("node:test");
const mongoose = require("mongoose");
const config = require("../config");

// Refuse ids minted before this run started (real tenants are older).
const PROCESS_START_SECONDS = Math.floor(Date.now() / 1000) - 60;
const tracked = new Set();

function assertFresh(id) {
  const oid = new mongoose.Types.ObjectId(String(id));
  if (oid.getTimestamp().getTime() / 1000 < PROCESS_START_SECONDS) {
    throw new Error(`fixtureTenants: refusing to track ${oid}, it predates this test run`);
  }
  return oid;
}

/** A fresh ObjectId recorded for cleanup; use for every fixture tenant id. */
function fixtureId() {
  const id = new mongoose.Types.ObjectId();
  tracked.add(String(id));
  return id;
}

/** Records a tenant (or its id) created in-test, e.g. via Tenant.create. */
function trackFixtureTenant(tenantOrId) {
  tracked.add(String(assertFresh(tenantOrId?._id ?? tenantOrId)));
  return tenantOrId;
}

// Collections without tenant_id, matched via the fixtures' own docs.
async function deleteUntenanted(db, ids) {
  const [products, locations] = await Promise.all([
    db.collection("products").find({ tenant_id: { $in: ids } }, { projection: { _id: 1 } }).toArray(),
    db.collection("locations").find({ tenant_id: { $in: ids } }, { projection: { _id: 1 } }).toArray(),
  ]);
  // fixtureId() also mints bare product/location ids; match those too.
  const trackedIds = [...tracked].map((id) => new mongoose.Types.ObjectId(id));
  const byOwner = {
    $or: [
      { product: { $in: [...products.map((p) => p._id), ...trackedIds] } },
      { location: { $in: [...locations.map((l) => l._id), ...trackedIds] } },
    ],
  };
  await Promise.all([db.collection("inventories").deleteMany(byOwner), db.collection("inventoryhistories").deleteMany(byOwner)]);
  // Counter ids are "<tenantId>:<name>".
  await db.collection("counters").deleteMany({ _id: { $in: [...tracked].map((id) => new RegExp(`^${id}:`)) } });
}

async function cleanupFixtureTenants() {
  if (!tracked.size) return;
  const ids = [...tracked].map(assertFresh);
  const conn = await mongoose.createConnection(config.mongoUri).asPromise();
  try {
    const { db } = conn;
    await deleteUntenanted(db, ids);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    for (const { name } of collections) {
      if (name === "tenants") continue;
      await db.collection(name).deleteMany({ tenant_id: { $in: ids } });
    }
    await db.collection("tenants").deleteMany({ _id: { $in: ids } });
  } finally {
    await conn.close();
  }
}

// Root-level hook: registered when a test file first requires this module.
after(cleanupFixtureTenants);

module.exports = { fixtureId, trackFixtureTenant, cleanupFixtureTenants };
