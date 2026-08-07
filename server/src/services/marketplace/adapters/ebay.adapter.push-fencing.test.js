// services/marketplace/adapters/ebay.adapter.push-fencing.test.js
//
// A stale/delayed push_quantity job must never overwrite a quantity that a
// newer push already confirmed — see MarketplaceListing.js's push_seq /
// last_pushed_seq schema comments and order-stock-sync.service.js#claimPushSeq.
//
// Mocks ebay.api.service's credentialsConfigured/updateInventoryQuantity
// (both destructured by ebay.adapter.js at require time, so these mocks
// must be installed BEFORE ebay.adapter.js is first required) so this can
// run without real eBay credentials.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/marketplace/adapters/ebay.adapter.push-fencing.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../../config");

const ebayApiService = require("../../ebay/ebay.api.service");
const updateInventoryQuantitySpy = mock.method(ebayApiService, "updateInventoryQuantity", async () => ({ ok: true }));
mock.method(ebayApiService, "credentialsConfigured", () => true);
mock.method(ebayApiService, "getAccessToken", async () => "fake-token");

const ebaySettingsService = require("../../ebay/ebay.settings.service");
mock.method(ebaySettingsService, "getSettings", async () => ({ tenant_id: null, sandbox: true }));

// ebay.adapter.js pulls in inventory.service.js (for resolveSkuToIds),
// which requires queues/ebay.queue.js at module load — its Bull/ioredis
// client otherwise keeps this process alive indefinitely, hanging any
// multi-file `node --test` run waiting on this one.
const { ebayQueue } = require("../../../queues/ebay.queue");
test.after(async () => {
  await ebayQueue.close();
});

test("push fencing: a stale (lower-seq) push is dropped and does not call the eBay API or move last_pushed_seq backward", async (t) => {
  await mongoose.connect(config.mongoUri);

  const Product = require("../../../models/Product");
  const Location = require("../../../models/Location");
  const Inventory = require("../../../models/Inventory");
  const MarketplaceListing = require("../../../models/MarketplaceListing");
  const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../../constants/marketplace.constants");

  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const sku = `FENCE-TEST-${suffix}`;

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Push fencing test ${suffix}`,
    slug: `push-fencing-test-${suffix}`,
    sku,
    status: "active",
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Fence loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 3 });

  const listing = await MarketplaceListing.create({
    tenant_id: tenantId,
    product: product._id,
    variant: null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_offer_id: `offer-${suffix}`,
    external_listing_id: `listing-${suffix}`,
    condition: "NEW",
    last_pushed_seq: 5, // a newer push already landed
  });

  const ebayAdapter = require("./ebay.adapter");

  const callsBefore = updateInventoryQuantitySpy.mock.callCount();

  // A delayed retry carrying an OLD seq (3) shows up after seq 5 already landed.
  await ebayAdapter.pushInventory(sku, 999, tenantId, 3);

  assert.equal(
    updateInventoryQuantitySpy.mock.callCount(),
    callsBefore,
    "a stale push must never call the eBay API at all",
  );

  const afterStale = await MarketplaceListing.findById(listing._id);
  assert.equal(afterStale.last_pushed_seq, 5, "last_pushed_seq must not move backward");
  assert.equal(afterStale.ebay_synced_quantity, null, "a dropped push must not touch the baseline");

  // A genuinely newer push (seq 6) must apply normally.
  await ebayAdapter.pushInventory(sku, 3, tenantId, 6);

  assert.equal(updateInventoryQuantitySpy.mock.callCount(), callsBefore + 1, "a newer push must call the eBay API");

  const afterFresh = await MarketplaceListing.findById(listing._id);
  assert.equal(afterFresh.last_pushed_seq, 6);
  assert.equal(afterFresh.ebay_synced_quantity, 3, "a confirmed newer push must update the baseline");

  await mongoose.disconnect();
});
