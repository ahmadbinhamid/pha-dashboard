// services/marketplace/sync.service.fencing.test.js
// Regression guard: sync_listing is the only writer path now and carries the same seq fence
// push_quantity used to have alone; tests the fence at sync.service.js#syncListing directly.
// Registers a fake "ebay" adapter to exercise fencing/dispatch without real eBay credentials.
// Fake external ids are unique per run and cleaned up in t.after, to avoid colliding with the
// unique partial index on external_listing_id/external_offer_id across reruns.
// Needs a live Mongo connection. Run: node --test src/services/marketplace/sync.service.fencing.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index"); // registers all schemas; syncListing populates Attachment via product.attachments
const registry = require("./registry");
const ebaySettingsService = require("../ebay/ebay.settings.service");
mock.method(ebaySettingsService, "getSettings", async () => ({ tenant_id: null, sandbox: true, marketplace_id: "EBAY_AU" }));

// Unique per process, since registry.register happens once at module load and can't be suffixed per-test.
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
  const tenantId = new mongoose.Types.ObjectId();

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

  // Hard delete (not soft-delete, which would leave the unique-indexed external ids behind).
  // One combined t.after, since Node's test runner doesn't guarantee ordering across multiple hooks.
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
