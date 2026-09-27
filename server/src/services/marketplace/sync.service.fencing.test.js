// services/marketplace/sync.service.fencing.test.js
// syncListing's seq fence drops stale pushes, via a fake adapter. Needs Mongo.

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index"); // registers schemas; syncListing populates Attachment
const registry = require("./registry");
const ebaySettingsService = require("../ebay/ebay.settings.service");
mock.method(ebaySettingsService, "getSettings", async () => ({ tenant_id: null, sandbox: true, marketplace_id: "EBAY_AU" }));

// Unique per process: registry.register runs once at load, can't vary per test.
const FAKE_EXTERNAL_LISTING_ID = `L-fencing-${crypto.randomUUID()}`;
const FAKE_EXTERNAL_OFFER_ID = `O-fencing-${crypto.randomUUID()}`;
const updateSpy = mock.fn(async () => ({
  external_listing_id: FAKE_EXTERNAL_LISTING_ID,
  external_offer_id: FAKE_EXTERNAL_OFFER_ID,
  quantity: 3,
}));
registry.register({ key: "ebay", publish: mock.fn(), update: updateSpy, end: mock.fn() });

const { syncListing } = require("./sync.service");

test("sync_listing fencing: a stale seq is dropped before the adapter is ever called; a fresh seq applies normally", async (t) => {
  await mongoose.connect(config.mongoUri);

  const Product = require("../../models/Product");
  const MarketplaceListing = require("../../models/MarketplaceListing");
  const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");

  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Sync fencing test ${suffix}`,
    slug: `sync-fencing-test-${suffix}`,
    sku: `FENCE2-${suffix}`,
    status: "active",
  });

  const listing = await MarketplaceListing.create({
    tenant_id: tenantId,
    product: product._id,
    variant: null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_listing_id: `L-${suffix}`,
    external_offer_id: `O-${suffix}`,
    condition: "NEW",
    last_pushed_seq: 5,
  });

  // Hard delete frees unique external ids; one t.after as hook order isn't fixed.
  t.after(async () => {
    await MarketplaceListing.deleteOne({ _id: listing._id });
    await Product.deleteOne({ _id: product._id });
    await mongoose.disconnect();
  });

  const callsBefore = updateSpy.mock.callCount();

  const staleResult = await syncListing(listing._id.toString(), 3);
  assert.deepEqual(staleResult, { skipped: true, reason: "stale_seq" });
  assert.equal(updateSpy.mock.callCount(), callsBefore, "a stale-seq job must never call the adapter at all");

  const freshResult = await syncListing(listing._id.toString(), 6);
  assert.equal(freshResult.ok, true);
  assert.equal(updateSpy.mock.callCount(), callsBefore + 1, "a fresh-seq job must call the adapter");
});
