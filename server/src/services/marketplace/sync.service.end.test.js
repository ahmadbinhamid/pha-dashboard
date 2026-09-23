// services/marketplace/sync.service.end.test.js
// TASK 4: endListing resolves the product/variant/SKU/settings context the adapters used to
// query themselves. Guards that each adapter still withdraws exactly what it did before.
// Needs a live Mongo connection.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

const ebayApi = require("../ebay/ebay.api.service");
const deleteSpy = mock.method(ebayApi, "deleteProduct", async () => ({ ok: true }));
const EBAY_SETTINGS = { sandbox: true, marketplace_id: "EBAY_AU" };
mock.method(require("../ebay/ebay.settings.service"), "getSettings", async () => EBAY_SETTINGS);
mock.method(require("../google/google.oauth.service"), "getValidAccessToken", async () => "tok");
const googleDeleteSpy = mock.method(require("../google/google.merchant.api.service"), "deleteProductInput", async () => ({}));

require("../../models/index");
const Product = require("../../models/Product");
const ProductVariant = require("../../models/ProductVariant");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelConnection = require("../../models/ChannelConnection");
const { registerAdapters } = require("./registerAdapters");
registerAdapters();
const { endListing } = require("./sync.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function product(tenantId, suffix) {
  return Product.create({ tenant_id: tenantId, title: `End ${suffix}`, slug: `end-${suffix}`, sku: `END-${suffix}`, status: "active" });
}

test("endListing (eBay): withdraws the variant's SKU with this tenant's settings", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const p = await product(tenantId, suffix);
  const variant = await ProductVariant.create({ tenant_id: tenantId, product: p._id, sku: `END-V-${suffix}` });
  const listing = await MarketplaceListing.create({
    tenant_id: tenantId, product: p._id, variant: variant._id, platform: "ebay", external_offer_id: `O-${suffix}`,
  });

  assert.deepEqual(await endListing(listing._id), { ok: true });
  assert.deepEqual(deleteSpy.mock.calls.at(-1).arguments, [EBAY_SETTINGS, `END-V-${suffix}`, `O-${suffix}`]);
});

test("endListing (eBay): a deleted product withdraws nothing and still resolves ok", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const p = await product(tenantId, suffix);
  const listing = await MarketplaceListing.create({ tenant_id: tenantId, product: p._id, platform: "ebay", external_offer_id: `O-${suffix}` });
  await Product.updateOne({ _id: p._id }, { deleted_at: new Date() });

  const before = deleteSpy.mock.callCount();
  assert.deepEqual(await endListing(listing._id), { ok: true });
  assert.equal(deleteSpy.mock.callCount(), before);
});

test("endListing (Google): deletes the product-SKU resource via the tenant's connection", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const p = await product(tenantId, suffix);
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "google", status: "connected", merchant_id: "m9", feed_label: "AU", content_language: "en",
  });
  const listing = await MarketplaceListing.create({ tenant_id: tenantId, product: p._id, platform: "google", external_listing_id: `en~AU~${p.sku}` });

  assert.deepEqual(await endListing(listing._id), { ok: true });
  assert.equal(googleDeleteSpy.mock.calls.at(-1).arguments[2], `accounts/m9/products/en~AU~END-${suffix}`);
});
