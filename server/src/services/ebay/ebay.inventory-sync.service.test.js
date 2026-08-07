// services/ebay/ebay.inventory-sync.service.test.js
//
// Regression coverage for the Aug 2026 sync-loop incident: an eBay sale
// deducted stock, then the reconciliation poller (running before eBay's own
// GetInventoryItem read had caught up to the sale it had just processed)
// saw a stale-vs-live mismatch and added the stock back — a false
// "manual edit on eBay" correction that silently undid a real sale.
//
// Mocks ebayApi.getAllInventoryItems and ebay.tenant#getConfiguredTenants
// via node:test's built-in mock support, since this exercises poll-timing
// behavior (a "lagging" eBay read) without a real eBay account. Mocks must
// be installed BEFORE ebay.inventory-sync.service.js is first required.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/ebay/ebay.inventory-sync.service.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");
const Product = require("../../models/Product");
const Location = require("../../models/Location");
const Inventory = require("../../models/Inventory");
const MarketplaceListing = require("../../models/MarketplaceListing");
const PendingReconciliation = require("../../models/PendingReconciliation");
const ebayApi = require("./ebay.api.service");
const ebayTenant = require("./ebay.tenant");
const ebaySettingsService = require("./ebay.settings.service");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");

// Installed at module scope, before inventory.service.js/pendingReconciliation
// .service.js are first required by any test below — every stock adjustment
// in this file fans out to enqueueEbayJob("sync_listing", ...), which would
// otherwise need a real Redis connection just to be a no-op. Also doubles as
// the spy the "accept does not push" test reads call counts from.
const ebayQueueModule = require("../../queues/ebay.queue");
const enqueueEbayJobSpy = mock.method(ebayQueueModule, "enqueueEbayJob", async () => {});

// Bull's underlying ioredis client keeps its connection open indefinitely by
// design (auto-reconnect) — without closing it, this process never exits on
// its own, which hangs any multi-file `node --test` run waiting on this one.
test.after(async () => {
  await ebayQueueModule.ebayQueue.close();
});

async function makeFixture() {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const sku = `SYNC-TEST-${suffix}`;

  const product = await Product.create({
    tenant_id: tenantId,
    title: `Sync loop test product ${suffix}`,
    slug: `sync-loop-test-${suffix}`,
    sku,
    status: "active",
  });

  const location = await Location.create({ tenant_id: tenantId, name: `Test location ${suffix}` });
  const inventory = await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 1 });

  const listing = await MarketplaceListing.create({
    tenant_id: tenantId,
    product: product._id,
    variant: null,
    platform: MARKETPLACE_PLATFORM.EBAY,
    state: LISTING_STATE.ACTIVE,
    external_offer_id: `offer-${suffix}`,
    external_listing_id: `listing-${suffix}`,
    condition: "NEW",
  });

  return { tenantId, sku, product, location, inventory, listing };
}

function installMocks(t, { tenant, ebayQtyBySku, complete = true }) {
  t.mock.method(ebayTenant, "getConfiguredTenants", async () => [
    { tenant: { _id: tenant.tenantId, id: tenant.tenantId.toString() }, settings: { tenant_id: tenant.tenantId, connection_status: "connected" } },
  ]);
  t.mock.method(ebayApi, "getAllInventoryItems", async () => ({
    items: Object.entries(ebayQtyBySku).map(([sku, quantity]) => ({
      sku,
      availability: { shipToLocationAvailability: { quantity } },
    })),
    complete,
  }));
  t.mock.method(ebaySettingsService, "markConnectionError", async () => {});
}

test("sync loop: a stale eBay read (still showing pre-sale quantity) is deferred, not applied, and self-resolves once eBay catches up — zero net stock change, zero PendingReconciliation rows", async (t) => {
  await mongoose.connect(config.mongoUri);
  const fixture = await makeFixture();

  // adjustStockBySku is what a real eBay sale triggers — stock 1 -> 0,
  // baseline correctly stamped to 0 (this is the "ground truth" write this
  // fix deliberately kept, see inventory.service.js's comment).
  const { adjustStockBySku } = require("../inventory.service");
  await adjustStockBySku(fixture.sku, -1, fixture.tenantId);

  const { reconcileEbayInventory } = require("./ebay.inventory-sync.service");

  // Poll #1: eBay's read side hasn't caught up yet — still reports the
  // PRE-sale quantity (1), even though the sale already happened.
  installMocks(t, { tenant: fixture, ebayQtyBySku: { [fixture.sku]: 1 } });
  const run1 = await reconcileEbayInventory();
  assert.equal(run1.flagged, 0, "a single-poll drift must never be flagged for review");

  let pendingCount = await PendingReconciliation.countDocuments({ tenant_id: fixture.tenantId });
  assert.equal(pendingCount, 0);

  let inv = await Inventory.findById(fixture.inventory._id);
  assert.equal(inv.stock_count, 0, "stock must still reflect the real sale after poll #1");

  // Poll #2: eBay's read side has now caught up — reports 0, matching our
  // baseline. Nothing to reconcile.
  t.mock.reset();
  installMocks(t, { tenant: fixture, ebayQtyBySku: { [fixture.sku]: 0 } });
  const run2 = await reconcileEbayInventory();
  assert.equal(run2.flagged, 0);

  pendingCount = await PendingReconciliation.countDocuments({ tenant_id: fixture.tenantId });
  assert.equal(pendingCount, 0, "eBay's lag resolving itself must never leave a review item behind");

  inv = await Inventory.findById(fixture.inventory._id);
  assert.equal(inv.stock_count, 0, "stock must be unchanged — the real sale is the only thing that ever happened");

  await mongoose.disconnect();
});

test("sync loop: a genuine drift confirmed on two consecutive polls is flagged for review, and never auto-applied to stock", async (t) => {
  await mongoose.connect(config.mongoUri);
  const fixture = await makeFixture();

  const { reconcileEbayInventory } = require("./ebay.inventory-sync.service");

  // Poll #1 — establish baseline (first time this listing is seen).
  installMocks(t, { tenant: fixture, ebayQtyBySku: { [fixture.sku]: 1 } });
  const run1 = await reconcileEbayInventory();
  assert.equal(run1.baselined, 1);

  // Poll #2 — a seller manually raises quantity to 5 directly in Seller Hub.
  t.mock.reset();
  installMocks(t, { tenant: fixture, ebayQtyBySku: { [fixture.sku]: 5 } });
  const run2 = await reconcileEbayInventory();
  assert.equal(run2.flagged, 0, "first sighting of a drift must be deferred, not flagged");

  let inv = await Inventory.findById(fixture.inventory._id);
  assert.equal(inv.stock_count, 1, "stock must not move on the first sighting");

  // Poll #3 — same drift (still 5) confirmed a second consecutive time.
  t.mock.reset();
  installMocks(t, { tenant: fixture, ebayQtyBySku: { [fixture.sku]: 5 } });
  const run3 = await reconcileEbayInventory();
  assert.equal(run3.flagged, 1, "a drift confirmed twice must be flagged exactly once");

  const rows = await PendingReconciliation.find({ tenant_id: fixture.tenantId });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].local_qty, 1);
  assert.equal(rows[0].ebay_qty, 5);
  assert.equal(rows[0].delta, 4);
  assert.equal(rows[0].status, "pending");

  inv = await Inventory.findById(fixture.inventory._id);
  assert.equal(inv.stock_count, 1, "confirming a drift must still never touch stock automatically — a human decides via accept/reject");

  await mongoose.disconnect();
});

test("sync loop: accepting a flagged reconciliation applies the delta to stock and does not enqueue an outbound eBay push", async (t) => {
  await mongoose.connect(config.mongoUri);
  const fixture = await makeFixture();

  const { upsertPending, acceptReconciliation } = require("../pendingReconciliation.service");
  await upsertPending({ tenantId: fixture.tenantId, listingId: fixture.listing._id, sku: fixture.sku, localQty: 1, ebayQty: 5 });

  const callsBefore = enqueueEbayJobSpy.mock.callCount();

  const row = await PendingReconciliation.findOne({ tenant_id: fixture.tenantId, status: "pending" });
  await acceptReconciliation(row._id, fixture.tenantId, null);

  const inv = await Inventory.findById(fixture.inventory._id);
  assert.equal(inv.stock_count, 5, "accepting must apply eBay's reported quantity to local stock");

  const resolved = await PendingReconciliation.findById(row._id);
  assert.equal(resolved.status, "accepted");

  // fanOutMarketplaceInventory (which would enqueue an outbound push) is
  // skipped via skipMarketplaceFanOut — accepting a number that CAME from
  // eBay has nothing to push back.
  assert.equal(
    enqueueEbayJobSpy.mock.callCount(),
    callsBefore,
    "accepting a reconciliation must not push a quantity back to eBay",
  );

  const listing = await MarketplaceListing.findById(fixture.listing._id);
  assert.equal(listing.ebay_synced_quantity, 5, "baseline must be updated to the now-confirmed eBay quantity");

  await mongoose.disconnect();
});

test("sync loop: a truncated getAllInventoryItems response never deletes a listing", async (t) => {
  await mongoose.connect(config.mongoUri);
  const fixture = await makeFixture();

  const { reconcileEbayInventory } = require("./ebay.inventory-sync.service");

  // The SKU is simply absent from this (incomplete) page — complete: false
  // signals the fetch didn't cover the whole account, so "absent" can't be
  // trusted as "deleted on eBay".
  installMocks(t, { tenant: fixture, ebayQtyBySku: {}, complete: false });

  // Run twice — MISSING_POLLS_THRESHOLD is 2, so if the incomplete-fetch
  // guard were missing, two runs would be enough to trigger deletion.
  await reconcileEbayInventory();
  await reconcileEbayInventory();

  const listing = await MarketplaceListing.findById(fixture.listing._id);
  assert.ok(listing, "listing must still exist — an incomplete fetch is not proof of deletion on eBay");
  assert.equal(listing.deleted_at, null);

  await mongoose.disconnect();
});
