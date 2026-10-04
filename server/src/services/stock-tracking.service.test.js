// services/stock-tracking.service.test.js
// Stock tracking backfill: dry run changes nothing; confirm flips and resyncs.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");
require("../models/index");
const Product = require("../models/Product");
const MarketplaceListing = require("../models/MarketplaceListing");

const inventoryService = require("./inventory.service");
const fanOut = mock.method(inventoryService, "fanOutMarketplaceInventory", async () => []);
const { enableStockTracking } = require("./stock-tracking.service");

const created = { products: [], listings: [] };
before(() => mongoose.connect(config.mongoUri));
after(async () => {
  await Product.collection.deleteMany({ _id: { $in: created.products } });
  await MarketplaceListing.collection.deleteMany({ _id: { $in: created.listings } });
  await mongoose.disconnect();
});

test("dry run lists untracked products; confirm turns tracking on and resyncs listed ones", async () => {
  const tenantId = fixtureId();
  const insert = async (stock_control) => {
    const { insertedId } = await Product.collection.insertOne({ tenant_id: tenantId, title: "t", slug: crypto.randomUUID(), sku: crypto.randomUUID(), stock_control, deleted_at: null });
    created.products.push(insertedId);
    return insertedId;
  };
  const listed = await insert(false);
  const unlisted = await insert(false);
  await insert(true);
  const { insertedId } = await MarketplaceListing.collection.insertOne({ tenant_id: tenantId, platform: "ebay", product: listed, external_listing_id: `L-${crypto.randomUUID()}`, external_offer_id: `O-${crypto.randomUUID()}` });
  created.listings.push(insertedId);

  const dry = await enableStockTracking({ tenantId });
  assert.equal(dry.confirmed, false);
  assert.equal(dry.products.length, 2);
  assert.equal((await Product.collection.findOne({ _id: listed })).stock_control, false, "dry run changes nothing");

  const done = await enableStockTracking({ tenantId, confirm: true });
  assert.equal(done.confirmed, true);
  assert.equal((await Product.collection.findOne({ _id: listed })).stock_control, true);
  assert.equal((await Product.collection.findOne({ _id: unlisted })).stock_control, true);
  assert.equal(fanOut.mock.callCount(), 1, "only the listed product is resynced");
  assert.equal((await enableStockTracking({ tenantId })).products.length, 0, "idempotent");
});
