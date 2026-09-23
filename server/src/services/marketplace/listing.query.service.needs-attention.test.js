// services/marketplace/listing.query.service.needs-attention.test.js
// Verifies needs_attention: true expands server-side to sync_status in [error, price_locked],
// excludes everything else, and takes precedence over a plain sync_status passed alongside it.
// Needs a live Mongo connection. Run: node --test src/services/marketplace/listing.query.service.needs-attention.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const Product = require("../../models/Product");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { LISTING_STATE, LISTING_SYNC_STATUS } = require("../../constants/marketplace.constants");
const { listListings, listListingsGroupedByProduct } = require("./listing.query.service");

async function makeProduct(tenantId) {
  const suffix = crypto.randomUUID();
  return Product.create({
    tenant_id: tenantId,
    title: `Needs-attention test ${suffix}`,
    slug: `needs-attention-test-${suffix}`,
    sku: `NA-${suffix}`,
    price: 42,
    status: "active",
  });
}

function makeListing(tenantId, productId, sync_status, platform = "ebay") {
  return MarketplaceListing.create({
    tenant_id: tenantId,
    product: productId,
    variant: null,
    platform,
    state: LISTING_STATE.ACTIVE,
    condition: platform === "ebay" ? "NEW" : "new",
    sync_status,
  });
}

// A product can have at most one listing per (platform, variant), so each test listing needs its own product.
async function makeListingWithNewProduct(tenantId, sync_status, platform = "ebay") {
  const product = await makeProduct(tenantId);
  return makeListing(tenantId, product._id, sync_status, platform);
}

test("listListings: needs_attention=true returns only error + price_locked listings, excluding synced/pending/not_listed/out_of_stock", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const tenantId = new mongoose.Types.ObjectId();

  await Promise.all([
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.SYNCED),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.PENDING),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.NOT_LISTED),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.OUT_OF_STOCK),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.ERROR),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.PRICE_LOCKED),
  ]);

  const { items, total } = await listListings({ skip: 0, limit: 20, needs_attention: true }, tenantId);

  assert.equal(total, 2, "only the error + price_locked listings should match");
  const statuses = items.map((l) => l.sync_status).sort();
  assert.deepEqual(statuses, [LISTING_SYNC_STATUS.ERROR, LISTING_SYNC_STATUS.PRICE_LOCKED].sort());
});

test("listListings: needs_attention=true takes precedence over a plain sync_status passed alongside it", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const tenantId = new mongoose.Types.ObjectId();

  await Promise.all([
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.SYNCED),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.ERROR),
  ]);

  // sync_status: "synced" would normally match the first listing — needs_attention must win instead.
  const { items, total } = await listListings(
    { skip: 0, limit: 20, sync_status: LISTING_SYNC_STATUS.SYNCED, needs_attention: true },
    tenantId,
  );

  assert.equal(total, 1);
  assert.equal(items[0].sync_status, LISTING_SYNC_STATUS.ERROR);
});

test("listListings: needs_attention omitted/false falls back to a plain sync_status filter unaffected", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const tenantId = new mongoose.Types.ObjectId();

  await Promise.all([
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.SYNCED),
    makeListingWithNewProduct(tenantId, LISTING_SYNC_STATUS.ERROR),
  ]);

  const { items, total } = await listListings({ skip: 0, limit: 20, sync_status: LISTING_SYNC_STATUS.SYNCED }, tenantId);
  assert.equal(total, 1);
  assert.equal(items[0].sync_status, LISTING_SYNC_STATUS.SYNCED);
});

test("listListingsGroupedByProduct: needs_attention=true narrows which PRODUCTS qualify, but a qualifying product's row still shows its full listing set", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const tenantId = new mongoose.Types.ObjectId();
  const productWithError = await makeProduct(tenantId);
  const productAllHealthy = await makeProduct(tenantId);

  await makeListing(tenantId, productWithError._id, LISTING_SYNC_STATUS.ERROR);
  // Same product also has a healthy google listing, which must still show up once the product qualifies.
  await MarketplaceListing.create({
    tenant_id: tenantId,
    product: productWithError._id,
    variant: null,
    platform: "google",
    state: LISTING_STATE.ACTIVE,
    condition: "new",
    sync_status: LISTING_SYNC_STATUS.SYNCED,
  });
  await makeListing(tenantId, productAllHealthy._id, LISTING_SYNC_STATUS.SYNCED);

  const { items, total } = await listListingsGroupedByProduct({ skip: 0, limit: 20, needs_attention: true }, tenantId);

  assert.equal(total, 1, "only the product with an error/price_locked listing qualifies");
  assert.equal(items[0].product._id.toString(), productWithError._id.toString());
  const platforms = items[0].listings.map((l) => l.platform).sort();
  assert.deepEqual(platforms, ["ebay", "google"], "the qualifying product's row must still show its healthy google listing too");
});
