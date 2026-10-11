// services/marketplace/default-brand.test.js
// Store default brand: Meta/Google fallback, eBay untouched, chunked resync.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { useMetaTestConfig, makeMetaTenant, makeMetaListing } = require("../../testUtils/metaFixtures");

const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const { encrypt, packCiphertext } = require("../../utils/crypto/tokenCipher");
const channelQueue = require("../../queues/channel.queue");
const registry = require("./registry");
const metaAdapter = require("./adapters/meta.adapter");
const googleAdapter = require("./adapters/google.adapter");
const ebayAdapter = require("./adapters/ebay.adapter");
registry.register(ebayAdapter);
registry.register(googleAdapter);
registry.register(metaAdapter);

const { resolveListing, hydrateResolved } = require("./listing.resolver");
const { buildInventoryItemFromResolved } = require("../ebay/ebay.api.service");
const tenantSettings = require("../tenant-settings.service");
const productService = require("../product.service");

const GOOGLE_SETTINGS = { content_language: "en", feed_label: "AU", target_country: "AU" };

let restoreConfig;
before(async () => {
  restoreConfig = useMetaTestConfig();
  await mongoose.connect(config.mongoUri);
});
after(async () => {
  restoreConfig();
  await mongoose.disconnect();
});
afterEach(() => mock.restoreAll());

// A real Tenant row (fixture id) so the store default can be read and set.
async function tenantWithDefault(defaultBrand) {
  const tenant = await makeMetaTenant();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenant.tenantId, name: `Brand ${suffix}`, slug: `brand-${suffix}`, code: `BR${suffix}`.toUpperCase(),
    status: "active", deleted_at: null, default_brand: defaultBrand,
  });
  return tenant;
}

// Product reloaded with photos populated, as sync.service loads it.
async function hydrated(fixture, adapter, tenantId) {
  const listing = adapter.key === "meta" ? fixture.listing : { ...fixture.listing.toObject(), platform: adapter.key };
  const product = await Product.findById(fixture.product._id).populate("attachments");
  const resolved = resolveListing(listing, product, null);
  await hydrateResolved([resolved], adapter, tenantId);
  return resolved;
}

const metaBrand = (resolved) => metaAdapter.buildItemData(resolved, 1, "https://store.example.com/product/x").brand;
const googleAttrs = (resolved) =>
  googleAdapter.buildProductInputFromResolved(resolved, GOOGLE_SETTINGS, 1, resolved.identifiers, "https://store.example.com/product/x").productAttributes;
const ebayItem = (resolved) => JSON.stringify(buildInventoryItemFromResolved(resolved, 1));

test("product with its own brand: used on Meta and Google, default ignored", async () => {
  const tenant = await tenantWithDefault("Parts Hub");
  const fixture = await makeMetaListing(tenant, { brand: "Bosch" });
  const meta = await hydrated(fixture, metaAdapter, tenant.tenantId);
  assert.equal(metaBrand(meta), "Bosch");
  assert.equal(meta.brandSource, "product");
  const google = await hydrated(fixture, googleAdapter, tenant.tenantId);
  assert.equal(googleAttrs(google).brand, undefined, "unchanged: Google sends brand only with an MPN pair");
  assert.equal(google.identifiers.brand, "Bosch");
});

test("product without brand, default set: default on Meta and Google, never paired with an MPN", async () => {
  const tenant = await tenantWithDefault("  Parts Hub  ");
  const fixture = await makeMetaListing(tenant, { brand: null });
  await fixture.product.updateOne({ mpn: "MPN-9" });
  fixture.product.mpn = "MPN-9";
  const meta = await hydrated(fixture, metaAdapter, tenant.tenantId);
  assert.equal(metaBrand(meta), "Parts Hub");
  assert.equal(meta.brandSource, "store_default");
  const attrs = googleAttrs(await hydrated(fixture, googleAdapter, tenant.tenantId));
  assert.equal(attrs.brand, "Parts Hub");
  assert.equal(attrs.mpn, undefined, "a store brand never forms an MPN identifier pair");
  assert.equal(attrs.identifierExists, false);
});

test("product without brand, no default: Meta still fails with the existing error", async () => {
  const tenant = await tenantWithDefault(null);
  const fixture = await makeMetaListing(tenant, { brand: null });
  const meta = await hydrated(fixture, metaAdapter, tenant.tenantId);
  assert.equal(meta.brand, null);
  const [result] = await metaAdapter.publishBatch([meta], { catalog_id: "222", access_token_ct: packCiphertext(encrypt("t")) });
  assert.equal(result.ok, false);
  assert.match(result.error, /brand is required by Meta/);
  const attrs = googleAttrs(await hydrated(fixture, googleAdapter, tenant.tenantId));
  assert.equal(attrs.brand, undefined, "Google unchanged without a default");
});

test("eBay output is byte-for-byte unchanged by a store default", async () => {
  const withDefault = await tenantWithDefault("Parts Hub");
  const without = await tenantWithDefault(null);
  for (const brand of [null, "Bosch"]) {
    // Same product, hydrated as each tenant: only the store default differs.
    const fixture = await makeMetaListing(withDefault, { brand });
    const ra = await hydrated(fixture, ebayAdapter, withDefault.tenantId);
    const rb = await hydrated(fixture, ebayAdapter, without.tenantId);
    assert.equal(ra.brand, brand, `brand=${brand}`);
    assert.equal(ebayItem(ra), ebayItem(rb), `brand=${brand}`);
  }
});

test("changing the default resyncs only brandless Meta/Google listings, in chunks", async () => {
  const tenant = await tenantWithDefault(null);
  const brandless = [];
  for (let i = 0; i < 3; i++) brandless.push(await makeMetaListing(tenant, { brand: null }));
  const branded = await makeMetaListing(tenant, { brand: "Bosch" });
  const google = await MarketplaceListing.create({ tenant_id: tenant.tenantId, product: brandless[0].product._id, platform: "google", state: "active" });
  const ebay = await MarketplaceListing.create({
    tenant_id: tenant.tenantId, product: brandless[1].product._id, platform: "ebay", state: "active",
    external_listing_id: `L-${crypto.randomUUID()}`, external_offer_id: `O-${crypto.randomUUID()}`,
  });
  const jobs = [];
  mock.method(channelQueue, "enqueueChannelJob", async (platform, name, data) => jobs.push({ platform, name, data }));
  const savedChunk = config.channels.batchChunkSize;
  config.channels.batchChunkSize = 2;
  try {
    await tenantSettings.updateTenantProfile(tenant.tenantId, { default_brand: "Parts Hub" });
  } finally {
    config.channels.batchChunkSize = savedChunk;
  }
  assert.ok(jobs.every((j) => j.name === "sync_batch"), "batch path, not per-product jobs");
  const metaJobs = jobs.filter((j) => j.platform === "meta");
  assert.deepEqual(metaJobs.map((j) => j.data.listingIds.length).sort(), [1, 2], "3 brandless Meta listings in chunks of 2");
  const metaIds = metaJobs.flatMap((j) => j.data.listingIds).sort();
  assert.deepEqual(metaIds, brandless.map((f) => String(f.listing._id)).sort());
  assert.ok(!metaIds.includes(String(branded.listing._id)), "a branded product is untouched");
  assert.deepEqual(jobs.filter((j) => j.platform === "google").flatMap((j) => j.data.listingIds), [String(google._id)]);
  assert.equal(jobs.filter((j) => j.platform === "ebay").length, 0, "eBay never resyncs");
  assert.ok(!jobs.some((j) => j.data.listingIds.includes(String(ebay._id))));

  jobs.length = 0;
  await tenantSettings.updateTenantProfile(tenant.tenantId, { default_brand: "Parts Hub", company_name: "X" });
  assert.equal(jobs.length, 0, "an unchanged default queues nothing");
  await tenantSettings.updateTenantProfile(tenant.tenantId, { default_brand: "" });
  assert.equal(jobs.filter((j) => j.platform === "meta").flatMap((j) => j.data.listingIds).length, 3, "clearing resyncs too");
  assert.equal(await tenantSettings.getDefaultBrand(tenant.tenantId), null);
});

test("the storefront's product data shows the brand the feed sends", async () => {
  const tenant = await tenantWithDefault("Parts Hub");
  const brandless = await makeMetaListing(tenant, { brand: null });
  const branded = await makeMetaListing(tenant, { brand: "Bosch" });
  for (const fixture of [brandless, branded]) {
    const page = await productService.getProductBySlugOrId(fixture.product.slug, tenant.tenantId);
    const feed = metaBrand(await hydrated(fixture, metaAdapter, tenant.tenantId));
    assert.equal(page.display.brand, feed);
  }
  const none = await tenantWithDefault(null);
  const plain = await makeMetaListing(none, { brand: null });
  assert.equal((await productService.getProductBySlugOrId(plain.product.slug, none.tenantId)).display.brand, null);
});

test("settings validator: default_brand is optional, trimmed and capped", () => {
  const { updateSettings } = require("../../validators/tenant-settings.validation");
  const { TENANT_DEFAULT_BRAND_MAX } = require("../../constants/tenant.constants");
  assert.equal(updateSettings.body.validate({ default_brand: "  Parts Hub " }).value.default_brand, "Parts Hub");
  assert.equal(updateSettings.body.validate({ default_brand: "" }).error, undefined);
  assert.equal(updateSettings.body.validate({ default_brand: null }).error, undefined);
  assert.ok(updateSettings.body.validate({ default_brand: "x".repeat(TENANT_DEFAULT_BRAND_MAX + 1) }).error);
});
