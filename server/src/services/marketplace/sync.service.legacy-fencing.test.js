// services/marketplace/sync.service.legacy-fencing.test.js
// Regression guard: push_seq/last_pushed_seq moved to the base schema, so a document written
// before that has no last_pushed_seq field at all. Proves fencing still works against a raw-inserted
// doc bypassing Mongoose, exercising whatever fallback this repo actually reads on such a document.
// Needs a live Mongo connection. Run: node --test src/services/marketplace/sync.service.legacy-fencing.test.js

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

// Randomized, not a fixed "L1"/"O1" literal, to avoid colliding with sync.service.fencing.test.js's
// leftover data under the shared unique index on external_listing_id/external_offer_id.
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
  const tenantId = new mongoose.Types.ObjectId();

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Legacy fencing test ${suffix}`,
    slug: `legacy-fencing-test-${suffix}`,
    sku: `LFENCE-${suffix}`,
    status: "active",
  });

  // Raw insert bypassing Mongoose, simulating a document created before the fields moved to the base schema.
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

  // Hard-delete (matching the raw insert, which bypassed soft-delete too), to avoid unbounded growth.
  // One combined t.after, since Node's test runner doesn't guarantee ordering across multiple hooks.
  t.after(async () => {
    await mongoose.connection.db.collection("marketplacelistings").deleteOne({ _id: insertResult.insertedId });
    await Product.deleteOne({ _id: product._id });
    await mongoose.disconnect();
  });

  const raw = await mongoose.connection.db.collection("marketplacelistings").findOne({ _id: insertResult.insertedId });
  assert.equal(raw.last_pushed_seq, undefined, "sanity check: the raw stored doc must have no last_pushed_seq field");

  const callsBefore = updateSpy.mock.callCount();

  // A negative seq is unambiguously older than a legacy doc's effective baseline (0) — must be dropped.
  const staleResult = await syncListing(listingId, -1);
  assert.deepEqual(staleResult, { skipped: true, reason: "stale_seq" });
  assert.equal(updateSpy.mock.callCount(), callsBefore, "a stale-seq job must never call the adapter for a legacy document");

  const freshResult = await syncListing(listingId, 1);
  assert.equal(freshResult.ok, true);
  assert.equal(updateSpy.mock.callCount(), callsBefore + 1, "a fresh-seq job must call the adapter even for a legacy document");
});
