// services/marketplace/sync.service.legacy-fencing.test.js
// Fencing works on a raw legacy doc with no last_pushed_seq field. Needs Mongo.

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

// Random ids avoid unique-index clashes with fencing.test.js leftovers.
const mockSuffix = crypto.randomUUID();
const updateSpy = mock.fn(async () => ({
  external_listing_id: `L1-${mockSuffix}`,
  external_offer_id: `O1-${mockSuffix}`,
  quantity: 3,
}));
registry.register({ key: "ebay", publish: mock.fn(), update: updateSpy, end: mock.fn() });

const { syncListing } = require("./sync.service");

test("sync_listing fencing: a legacy document with NO last_pushed_seq field at all still fences correctly", async (t) => {
  await mongoose.connect(config.mongoUri);

  const Product = require("../../models/Product");
  const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");

  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Legacy fencing test ${suffix}`,
    slug: `legacy-fencing-test-${suffix}`,
    sku: `LFENCE-${suffix}`,
    status: "active",
  });

  // Raw insert bypasses Mongoose to simulate a pre-migration document.
  const insertResult = await mongoose.connection.db.collection("marketplacelistings").insertOne({
    tenant_id: tenantId,
    product: product._id,
    variant: null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    sync_status: "synced",
    external_listing_id: `L-${suffix}`,
    external_offer_id: `O-${suffix}`,
    condition: "NEW",
    created_at: new Date(),
    updated_at: new Date(),
  });
  const listingId = insertResult.insertedId.toString();

  // Hard-delete like the raw insert; one t.after as hook order isn't guaranteed.
  t.after(async () => {
    await mongoose.connection.db.collection("marketplacelistings").deleteOne({ _id: insertResult.insertedId });
    await Product.deleteOne({ _id: product._id });
    await mongoose.disconnect();
  });

  const raw = await mongoose.connection.db.collection("marketplacelistings").findOne({ _id: insertResult.insertedId });
  assert.equal(raw.last_pushed_seq, undefined, "sanity check: the raw stored doc must have no last_pushed_seq field");

  const callsBefore = updateSpy.mock.callCount();

  // Negative seq is older than a legacy doc's baseline (0), so must be dropped.
  const staleResult = await syncListing(listingId, -1);
  assert.deepEqual(staleResult, { skipped: true, reason: "stale_seq" });
  assert.equal(updateSpy.mock.callCount(), callsBefore, "a stale-seq job must never call the adapter for a legacy document");

  const freshResult = await syncListing(listingId, 1);
  assert.equal(freshResult.ok, true);
  assert.equal(updateSpy.mock.callCount(), callsBefore + 1, "a fresh-seq job must call the adapter even for a legacy document");
});
