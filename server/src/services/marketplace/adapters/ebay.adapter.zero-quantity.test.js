// services/marketplace/adapters/ebay.adapter.zero-quantity.test.js
//
// Regression guard: a manual stock correction to 0 must actually reach
// eBay. Before this fix, publish()/update() both had an early
// `if (quantity === 0) return { skipped: true, reason: "out_of_stock" }`
// BEFORE any write — and a manual dashboard stock correction reaches eBay
// ONLY via fan-out -> sync_listing -> update() (Stripe sales took a
// different, now-removed push_quantity path, which is why this bug hid
// for as long as it did). The result: correcting stock to 0 in the
// dashboard silently never told eBay, which kept selling stock that didn't
// exist. eBay must now receive the real 0 and stay listed via its own
// out-of-stock handling (marketplace/sync.service.js sets sync_status
// OUT_OF_STOCK for visibility, but only after this write succeeds).
//
// Mocks ebay.api.service's credentialsConfigured/getAccessToken/
// upsertInventoryItem (all destructured by ebay.adapter.js at require
// time, so must be installed BEFORE ebay.adapter.js is first required).
// buildInventoryItemFromResolved/buildOfferFromResolved are left real, so
// this also exercises their actual null-quantity omission logic.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/marketplace/adapters/ebay.adapter.zero-quantity.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../../config");

const ebayApiService = require("../../ebay/ebay.api.service");
mock.method(ebayApiService, "credentialsConfigured", () => true);
mock.method(ebayApiService, "getAccessToken", async () => "fake-token");
const upsertInventoryItemSpy = mock.method(ebayApiService, "upsertInventoryItem", async () => ({ ok: true }));

const ebaySettingsService = require("../../ebay/ebay.settings.service");
mock.method(ebaySettingsService, "getSettings", async () => ({ tenant_id: null, sandbox: true, marketplace_id: "EBAY_AU" }));

// ebay.adapter.js pulls in inventory.service.js (for getTotalStockForProductVariant),
// which requires queues/ebay.queue.js at module load — its Bull/ioredis
// client otherwise keeps this process alive indefinitely, hanging any
// multi-file `node --test` run waiting on this one.
const { ebayQueue } = require("../../../queues/ebay.queue");
test.after(async () => {
  await ebayQueue.close();
});

async function makeFixture({ stockControl, stockCount }) {
  const mongooseLib = require("mongoose");
  const Product = require("../../../models/Product");
  const Location = require("../../../models/Location");
  const Inventory = require("../../../models/Inventory");
  const MarketplaceListing = require("../../../models/MarketplaceListing");
  const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../../constants/marketplace.constants");

  const suffix = crypto.randomUUID();
  const tenantId = new mongooseLib.Types.ObjectId();
  const sku = `ZEROQ-${suffix}`;

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Zero quantity test ${suffix}`,
    slug: `zero-quantity-test-${suffix}`,
    sku,
    status: "active",
    stock_control: stockControl,
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Zero-q loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: stockCount });

  const listing = await MarketplaceListing.create({
    tenant_id: tenantId,
    product: product._id,
    variant: null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_listing_id: `L-${suffix}`,
    external_offer_id: `O-${suffix}`,
    condition: "NEW",
    // ebay_category_id deliberately left unset — update() then returns
    // right after the inventory-item write (the part this test cares
    // about), before touching offer/policy machinery this test doesn't
    // need to mock.
  });

  return { tenantId, product, listing };
}

test("manual correction to 0 (stock_control=true): quantity 0 is pushed to eBay, not skipped", async (t) => {
  await mongoose.connect(config.mongoUri);
  const { tenantId, product, listing } = await makeFixture({ stockControl: true, stockCount: 0 });

  const { resolveListing } = require("../listing.resolver");
  const ebayAdapter = require("./ebay.adapter");
  const MarketplaceListing = require("../../../models/MarketplaceListing");

  const populatedProduct = { ...product.toObject(), attachments: [] };
  const resolved = resolveListing(listing, populatedProduct, null);

  const callsBefore = upsertInventoryItemSpy.mock.callCount();
  const result = await ebayAdapter.update(resolved, { tenant_id: tenantId, sandbox: true, marketplace_id: "EBAY_AU" }, {});

  assert.notEqual(result.skipped, true, "must not be skipped as out_of_stock — it must actually push 0");
  assert.equal(result.quantity, 0);
  assert.equal(upsertInventoryItemSpy.mock.callCount(), callsBefore + 1, "the inventory item write must actually happen");

  const pushedBody = upsertInventoryItemSpy.mock.calls[upsertInventoryItemSpy.mock.calls.length - 1].arguments[2];
  assert.equal(pushedBody.availability.shipToLocationAvailability.quantity, 0, "eBay must receive the true 0, not a skipped write");

  const afterListing = await MarketplaceListing.findById(listing._id);
  assert.equal(afterListing.ebay_synced_quantity, 0, "baseline must reflect the confirmed 0 push");

  await mongoose.disconnect();
});

test("stock_control=false: no quantity is ever sent to eBay, and updateSyncBaseline is never called", async (t) => {
  await mongoose.connect(config.mongoUri);
  const { tenantId, product, listing } = await makeFixture({ stockControl: false, stockCount: 0 });

  const { resolveListing } = require("../listing.resolver");
  const ebayAdapter = require("./ebay.adapter");
  const MarketplaceListing = require("../../../models/MarketplaceListing");

  const populatedProduct = { ...product.toObject(), attachments: [] };
  const resolved = resolveListing(listing, populatedProduct, null);

  const callsBefore = upsertInventoryItemSpy.mock.callCount();
  const result = await ebayAdapter.update(resolved, { tenant_id: tenantId, sandbox: true, marketplace_id: "EBAY_AU" }, {});

  assert.equal(result.quantity, null);
  assert.equal(upsertInventoryItemSpy.mock.callCount(), callsBefore + 1, "the inventory item call still happens (title/condition/etc still sync)");

  const pushedBody = upsertInventoryItemSpy.mock.calls[upsertInventoryItemSpy.mock.calls.length - 1].arguments[2];
  assert.equal(pushedBody.availability, undefined, "no availability block at all for an untracked-stock product");

  const afterListing = await MarketplaceListing.findById(listing._id);
  assert.equal(afterListing.ebay_synced_quantity, null, "updateSyncBaseline must never be called for a null (untracked) quantity");

  await mongoose.disconnect();
});
