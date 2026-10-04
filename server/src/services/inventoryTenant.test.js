// services/inventoryTenant.test.js
// New stock rows carry tenant_id; legacy rows still work; backfill is safe.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");

require("../models/index");
const Product = require("../models/Product");
const Location = require("../models/Location");
const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const inventoryService = require("./inventory.service");
const { ensureInventoryForProduct } = require("./product.service");
const { backfillInventoryTenantId } = require("./inventoryTenantBackfill.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function makeStock() {
  const tenantId = fixtureId();
  const suffix = crypto.randomUUID();
  const product = await Product.create({ tenant_id: tenantId, title: `Stock ${suffix}`, slug: `stock-${suffix}`, sku: `ST-${suffix}` });
  const location = await Location.create({ tenant_id: tenantId, name: `Shelf ${suffix}` });
  return { tenantId, product, location };
}

// A pre-migration row: no tenant_id field at all.
async function insertLegacyRecord(product, location, stock = 5) {
  const { insertedId } = await Inventory.collection.insertOne({
    product: product._id, variant: null, location: location._id, stock_count: stock, stock_reserved: 0,
    created_at: new Date(), updated_at: new Date(),
  });
  return insertedId;
}

const historyFor = (inventoryId) => InventoryHistory.find({ inventory: inventoryId }).sort({ created_at: 1 }).lean();

test("new Inventory rows carry tenant_id on both create paths", async () => {
  const { tenantId, product, location } = await makeStock();

  const viaEnsure = await inventoryService.ensureRecord({ product: product._id, location: location._id }, tenantId);
  assert.equal(String(viaEnsure.tenant_id), String(tenantId));

  const other = await makeStock();
  await ensureInventoryForProduct(other.product._id, null, other.tenantId);
  const viaProduct = await Inventory.findOne({ product: other.product._id }).lean();
  assert.equal(String(viaProduct.tenant_id), String(other.tenantId));
});

test("new InventoryHistory rows carry tenant_id from adjust and set", async () => {
  const { tenantId, product, location } = await makeStock();
  const record = await inventoryService.ensureRecord({ product: product._id, location: location._id }, tenantId);

  await inventoryService.adjustStock(record, { adjustment: 3, reason: "test", tenantId, skipMarketplaceFanOut: true });
  await inventoryService.setStock(record, { stock_count: 10, reason: "count", tenantId });

  const history = await historyFor(record._id);
  assert.equal(history.length, 2);
  for (const row of history) assert.equal(String(row.tenant_id), String(tenantId));
});

test("a legacy row without tenant_id still reads and updates through the product", async () => {
  const { tenantId, product, location } = await makeStock();
  const legacyId = await insertLegacyRecord(product, location, 5);

  const record = await inventoryService.findRecord(legacyId, tenantId);
  assert.ok(record, "found via the product join, not tenant_id");
  assert.equal(record.tenant_id, null);
  assert.equal(await inventoryService.findRecord(legacyId, fixtureId()), null, "other tenants still can't see it");

  const listed = await inventoryService.listInventory(tenantId, { product: String(product._id) });
  assert.equal(listed.items?.length ?? listed.length, 1);

  const { stock_after } = await inventoryService.adjustStock(record, { adjustment: -2, tenantId, skipMarketplaceFanOut: true });
  assert.equal(stock_after, 3);
  assert.equal((await Inventory.findById(legacyId).lean()).stock_count, 3);
  const [history] = await historyFor(legacyId);
  assert.equal(String(history.tenant_id), String(tenantId), "its new history row is tagged");

  // A re-ensure of the same row never rewrites it.
  await inventoryService.ensureRecord({ product: product._id, location: location._id }, tenantId);
  assert.equal((await Inventory.findById(legacyId).lean()).tenant_id, undefined);
});

test("backfill: dry-run writes nothing; confirm tags only that tenant's rows, idempotently", async () => {
  const { tenantId, product, location } = await makeStock();
  const legacyId = await insertLegacyRecord(product, location);
  const { insertedId: historyId } = await InventoryHistory.collection.insertOne({
    inventory: legacyId, product: product._id, variant: null, location: location._id,
    adjustment: 1, stock_before: 4, stock_after: 5, created_at: new Date(),
  });
  // Product gone: reported, never guessed.
  const orphanProduct = fixtureId();
  const { insertedId: orphanId } = await Inventory.collection.insertOne({
    product: orphanProduct, variant: null, location: location._id, stock_count: 1,
  });

  const orphansBefore = (await backfillInventoryTenantId({ tenantId: fixtureId() })).inventories.orphans;
  const dry = await backfillInventoryTenantId({ tenantId });
  assert.equal(dry.inventories.byTenant[tenantId], 1);
  assert.equal(dry.inventoryhistories.byTenant[tenantId], 1);
  assert.equal(dry.inventories.orphans, orphansBefore, "orphans are counted in every run");
  assert.equal((await Inventory.findById(legacyId).lean()).tenant_id, undefined, "dry run wrote nothing");

  const first = await backfillInventoryTenantId({ tenantId, confirm: true });
  assert.equal(first.inventories.updated, 1);
  assert.equal(first.inventoryhistories.updated, 1);
  assert.equal(String((await Inventory.findById(legacyId).lean()).tenant_id), String(tenantId));
  assert.equal(String((await InventoryHistory.findById(historyId).lean()).tenant_id), String(tenantId));
  assert.equal((await Inventory.findById(orphanId).lean()).tenant_id, undefined, "orphan untouched");

  const second = await backfillInventoryTenantId({ tenantId, confirm: true });
  assert.equal(second.inventories.updated + second.inventoryhistories.updated, 0, "re-run is a no-op");
});
