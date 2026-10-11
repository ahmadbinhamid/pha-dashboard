// services/marketplace/adapters/meta.adapter.test.js
// Meta adapter contract, payload, images, untracked stock, category order.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const config = require("../../../config");
const { fixtureId } = require("../../../testUtils/fixtureTenants");
const { useMetaTestConfig, makeMetaTenant, makeMetaListing, stubGraph } = require("../../../testUtils/metaFixtures");

const CategoryMapping = require("../../../models/CategoryMapping");
const ChannelSyncLog = require("../../../models/ChannelSyncLog");
const MarketplaceListing = require("../../../models/MarketplaceListing");
const registry = require("../registry");
const metaAdapter = require("./meta.adapter");
registry.register(require("./google.adapter"));
registry.register(metaAdapter);

const { syncListing } = require("../sync.service");
const { resolveListing, hydrateResolved } = require("../listing.resolver");

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

const { encrypt, packCiphertext } = require("../../../utils/crypto/tokenCipher");
const SETTINGS = { catalog_id: "222", access_token_ct: packCiphertext(encrypt("token-1")) };

// Hand-built resolved object; no DB needed for payload rules.
function resolvedFor(overrides = {}) {
  return {
    sku: "SKU-1",
    title: "Brake pad",
    description: "<p>Front <strong>pads</strong></p>",
    price: 12.5,
    brand: "Bosch",
    condition: "NEW",
    photos: [{ url: "https://cdn.example.com/a.png" }, { url: "https://cdn.example.com/b.png" }],
    photoSizes: [{ width: 600, height: 600 }, { width: 900, height: 900 }],
    identifiers: { gtin: "012345678905", mpn: "MPN-1", brand: "Bosch" },
    category: { id: "8526", source: "mapping" },
    listing: { meta_product_category: null },
    product: { _id: "p1", stock_control: true },
    variant: null,
    stock: { stock_control: true, quantity: 3 },
    productUrl: "https://store.example.com/product/brake-pad",
    ...overrides,
  };
}

async function freshListing(id) {
  return MarketplaceListing.collection.findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
}

test("meta adapter: conforms to the registry contract", () => {
  assert.equal(metaAdapter.key, "meta");
  for (const field of ["key", "name", "logo", "description", "status", "authType", "setupSteps", "requiredTenantData", "fieldSchema"]) {
    assert.ok(field in metaAdapter.manifest, `manifest.${field}`);
  }
  assert.equal(metaAdapter.manifest.requiresStorefront, true);
  assert.deepEqual(metaAdapter.capabilities, {
    publish: true, inventory: true, batch: true, asyncPublish: true,
    orders: false, webhooks: false, inboundInventory: false, variants: true,
  });
  for (const fn of ["loadSettings", "publish", "update", "end", "publishBatch", "checkBatchStatus"]) {
    assert.equal(typeof metaAdapter[fn], "function", fn);
  }
  assert.equal(metaAdapter.categoryField, "meta_product_category");
  assert.equal(metaAdapter.categoryFallbackPlatform, "google");
  assert.equal(metaAdapter.refreshIntervalDays, undefined, "Meta docs name no refresh cadence");
});

test("payload: price format, availability, condition, plain description, identifiers", () => {
  const data = metaAdapter.buildItemData(resolvedFor(), 3, "https://store.example.com/product/brake-pad");
  assert.equal(data.id, "SKU-1");
  assert.equal(data.price, `12.50 ${config.stripe.currency.toUpperCase()}`);
  assert.match(data.price, /^\d+\.\d{2} [A-Z]{3}$/);
  assert.equal(data.availability, "in stock");
  assert.equal(data.condition, "new");
  assert.equal(data.description, "Front pads");
  assert.equal(data.image_link, "https://cdn.example.com/a.png");
  assert.deepEqual(data.additional_image_link, ["https://cdn.example.com/b.png"]);
  assert.equal(data.quantity_to_sell_on_facebook, 3);
  assert.equal(data.google_product_category, "8526");
  assert.equal(data.gtin, "012345678905");
  assert.equal(data.item_group_id, undefined, "no group id without a variant");
  assert.equal(metaAdapter.availabilityFor(0), "out of stock");
});

test("payload: variants share an item_group_id derived from the product", () => {
  const a = metaAdapter.buildItemData(resolvedFor({ sku: "V-L", variant: { _id: "v1" } }), 1, "https://x/p");
  const b = metaAdapter.buildItemData(resolvedFor({ sku: "V-R", variant: { _id: "v2" } }), 1, "https://x/p");
  assert.equal(a.item_group_id, "ph-p1");
  assert.equal(a.item_group_id, b.item_group_id);
  assert.notEqual(a.id, b.id);
});

test("images: non-HTTPS or undersized primary fails the item without calling Meta", async () => {
  const calls = stubGraph();
  const results = await metaAdapter.publishBatch(
    [
      resolvedFor({ sku: "HTTP", photos: [{ url: "http://cdn.example.com/a.png" }] }),
      resolvedFor({ sku: "SMALL", photoSizes: [{ width: 499, height: 800 }] }),
      resolvedFor({ sku: "UNKNOWN", photoSizes: [null] }),
      resolvedFor({ sku: "NONE", photos: [], photoSizes: [] }),
    ],
    SETTINGS,
  );
  assert.equal(calls.itemsBatch.length, 0, "no items_batch call when every item fails locally");
  for (const r of results) {
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  }
  assert.match(results[0].error, /HTTPS/);
  assert.match(results[1].error, /499x800; Meta needs at least 500x500/);
});

test("images: an undersized additional image is dropped, not fatal", () => {
  const data = metaAdapter.buildItemData(resolvedFor({ photoSizes: [{ width: 600, height: 600 }, { width: 100, height: 100 }] }), 1, "https://x/p");
  assert.equal(data.additional_image_link, undefined);
});

test("publishBatch: Meta's per-row validation errors fail only that item", async () => {
  const calls = stubGraph({
    itemsBatch: () => [200, { handles: ["h1"], validation_status: [{ retailer_id: "BAD", errors: [{ message: "Invalid gtin" }] }] }],
  });
  const results = await metaAdapter.publishBatch([resolvedFor({ sku: "GOOD" }), resolvedFor({ sku: "BAD" })], SETTINGS);
  assert.equal(calls.itemsBatch.length, 1);
  assert.equal(calls.itemsBatch[0].body.item_type, "PRODUCT_ITEM");
  assert.ok(calls.itemsBatch[0].body.appsecret_proof, "appsecret_proof sent on every call");
  assert.deepEqual(calls.itemsBatch[0].requests.map((r) => r.method), ["UPDATE", "UPDATE"]);
  assert.equal(results[0].pending, true);
  assert.equal(results[0].handle, "h1");
  assert.equal(results[0].external_listing_id, "meta:222:GOOD");
  assert.equal(results[1].ok, false);
  assert.match(results[1].error, /Invalid gtin/);
});

test("untracked stock: skipped with a log row and no API call", async () => {
  const savedLog = config.channels.logSuccesses;
  config.channels.logSuccesses = true;
  try {
    const tenant = await makeMetaTenant();
    const { listing } = await makeMetaListing(tenant, { stockControl: false });
    const calls = stubGraph();
    const result = await syncListing(String(listing._id), 1);
    assert.deepEqual(result, { skipped: true, reason: "untracked_stock" });
    assert.equal(calls.itemsBatch.length, 0);
    const row = await ChannelSyncLog.findOne({ tenant_id: tenant.tenantId, entity_id: listing._id }).lean();
    assert.equal(row.status, "skipped");
    assert.equal(row.error_code, "untracked_stock");
    assert.equal((await freshListing(listing._id)).sync_status, "not_listed");
  } finally {
    config.channels.logSuccesses = savedLog;
  }
});

test("category: listing value -> meta mapping -> google mapping -> unset", async () => {
  const tenant = await makeMetaTenant();
  const catA = fixtureId();
  const catB = fixtureId();
  await CategoryMapping.create([
    { tenant_id: tenant.tenantId, product_category_id: catA, platform: "meta", external_category_id: "META-1" },
    { tenant_id: tenant.tenantId, product_category_id: catA, platform: "google", external_category_id: "GOOGLE-A" },
    { tenant_id: tenant.tenantId, product_category_id: catB, platform: "google", external_category_id: "GOOGLE-B" },
  ]);
  const own = await makeMetaListing(tenant, { categories: [catA], listing: { meta_product_category: "OWN" } });
  const metaMapped = await makeMetaListing(tenant, { categories: [catA], listing: { meta_product_category: null } });
  const googleMapped = await makeMetaListing(tenant, { categories: [catB], listing: { meta_product_category: null } });
  const unset = await makeMetaListing(tenant, { categories: [], listing: { meta_product_category: null } });

  const resolvedList = [own, metaMapped, googleMapped, unset].map((f) => resolveListing(f.listing, f.product, null));
  await hydrateResolved(resolvedList, metaAdapter, tenant.tenantId);
  const [r1, r2, r3, r4] = resolvedList;
  assert.deepEqual([r1.category.id, r1.category.source], ["OWN", "listing"]);
  assert.deepEqual([r2.category.id, r2.category.source], ["META-1", "mapping"]);
  assert.deepEqual([r3.category.id, r3.category.source, r3.category.platform], ["GOOGLE-B", "fallback_mapping", "google"]);
  assert.equal(r4.category, null);

  // Unset category fails the item loudly (required), before any API call.
  const calls = stubGraph();
  const [result] = await metaAdapter.publishBatch([r4], SETTINGS);
  assert.equal(result.ok, false);
  assert.match(result.error, /Product category is required/);
  assert.equal(calls.itemsBatch.length, 0);
});

test("google adapter: a Google mapping is never relabelled for Google itself", async () => {
  const tenant = await makeMetaTenant();
  const cat = fixtureId();
  await CategoryMapping.create({ tenant_id: tenant.tenantId, product_category_id: cat, platform: "google", external_category_id: "G-1" });
  const { listing, product } = await makeMetaListing(tenant, { categories: [cat] });
  const resolved = resolveListing({ ...listing.toObject(), platform: "google", google_product_category: null }, product, null);
  await hydrateResolved([resolved], { key: "google", categoryField: "google_product_category" }, tenant.tenantId);
  assert.equal(resolved.category.source, "mapping");
  assert.equal(resolved.category.platform, undefined);
});
