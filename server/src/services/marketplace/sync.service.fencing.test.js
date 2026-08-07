// services/marketplace/sync.service.fencing.test.js
//
// Regression guard for the "second writer path" gap: the old push_quantity
// job was the only fenced writer — sync_listing (fanned out by every manual
// stock correction) ran at concurrency 2 with no seq at all, so a stale
// sync_listing job could still land after a newer one and, in the old
// snapshot-quantity design, overwrite a correct value with a stale one.
// sync_listing is now the ONLY writer path and carries the same seq fence
// (see ebay.adapter.js's module header comment) — this tests that fence
// directly at the sync.service.js#syncListing layer, where the drop
// actually happens.
//
// Registers a fake "ebay" adapter (not the real ebayAdapter) so this
// exercises only the fencing/dispatch logic, without needing real eBay
// credentials — same reasoning as mocking ebayApi.* elsewhere in this suite.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/marketplace/sync.service.fencing.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index"); // registers all schemas — syncListing populates Attachment via product.attachments
const registry = require("./registry");
const ebaySettingsService = require("../ebay/ebay.settings.service");
mock.method(ebaySettingsService, "getSettings", async () => ({ tenant_id: null, sandbox: true, marketplace_id: "EBAY_AU" }));

const updateSpy = mock.fn(async () => ({ external_listing_id: "L1", external_offer_id: "O1", quantity: 3 }));
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

  const callsBefore = updateSpy.mock.callCount();

  const staleResult = await syncListing(listing._id.toString(), 3);
  assert.deepEqual(staleResult, { skipped: true, reason: "stale_seq" });
  assert.equal(updateSpy.mock.callCount(), callsBefore, "a stale-seq job must never call the adapter at all");

  const freshResult = await syncListing(listing._id.toString(), 6);
  assert.equal(freshResult.ok, true);
  assert.equal(updateSpy.mock.callCount(), callsBefore + 1, "a fresh-seq job must call the adapter");

  await mongoose.disconnect();
});
