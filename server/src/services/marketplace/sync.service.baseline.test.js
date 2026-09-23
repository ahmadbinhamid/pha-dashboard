// services/marketplace/sync.service.baseline.test.js
// End-to-end half of ebay.adapter.zero-quantity.test.js after TASK 4: through syncListing, a
// confirmed 0 push stamps the eBay baseline (ebay_synced_quantity + generic synced_quantity),
// and an untracked-stock product never does. Needs a live Mongo connection.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

const ebayApi = require("../ebay/ebay.api.service");
mock.method(ebayApi, "credentialsConfigured", () => true);
mock.method(ebayApi, "getAccessToken", async () => "fake-token");
mock.method(ebayApi, "upsertInventoryItem", async () => ({ ok: true }));
mock.method(require("../ebay/ebay.settings.service"), "getSettings", async () => ({ sandbox: true, marketplace_id: "EBAY_AU" }));

require("../../models/index");
const Product = require("../../models/Product");
const Location = require("../../models/Location");
const Inventory = require("../../models/Inventory");
const MarketplaceListing = require("../../models/MarketplaceListing");
const registry = require("./registry");
registry.register(require("./adapters/ebay.adapter"));
const { syncListing } = require("./sync.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function makeFixture({ stockControl, stockCount }) {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const product = await Product.create({
    tenant_id: tenantId, title: `Baseline ${suffix}`, slug: `baseline-${suffix}`, sku: `BL-${suffix}`, status: "active", stock_control: stockControl,
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: stockCount });
  return MarketplaceListing.create({
    tenant_id: tenantId, product: product._id, platform: "ebay", state: "active",
    external_listing_id: `L-${suffix}`, external_offer_id: `O-${suffix}`, condition: "NEW",
  });
}

test("syncListing: a confirmed 0 push stamps both the eBay and generic baselines, with the fencing seq", async () => {
  const listing = await makeFixture({ stockControl: true, stockCount: 0 });

  const result = await syncListing(listing._id.toString(), 3);
  assert.equal(result.ok, true);

  const after = await MarketplaceListing.findById(listing._id).lean();
  assert.equal(after.ebay_synced_quantity, 0, "baseline must reflect the confirmed 0 push");
  assert.equal(after.synced_quantity, 0);
  assert.equal(after.ebay_pending_reconcile_qty, null);
  assert.equal(after.last_pushed_seq, 3);
  assert.equal(after.sync_status, "out_of_stock");
});

test("syncListing: stock_control=false never stamps a baseline", async () => {
  const listing = await makeFixture({ stockControl: false, stockCount: 0 });

  const result = await syncListing(listing._id.toString(), null);
  assert.equal(result.ok, true);

  const after = await MarketplaceListing.findById(listing._id).lean();
  assert.equal(after.ebay_synced_quantity, null, "baseline must never be written for an untracked quantity");
  assert.equal(after.synced_quantity, null);
});
