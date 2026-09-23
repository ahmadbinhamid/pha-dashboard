// services/categoryMapping.service.test.js
// Category resolution order, tenant isolation and Google suggestions. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");

require("../models/index");
const Category = require("../models/Category");
const Product = require("../models/Product");
const registry = require("./marketplace/registry");
registry.register(require("./marketplace/adapters/ebay.adapter"));
registry.register(require("./marketplace/adapters/google.adapter"));

const service = require("./categoryMapping.service");
const { resolveListing, hydrateResolved } = require("./marketplace/listing.resolver");
const googleAdapter = require("./marketplace/adapters/google.adapter");
const { validateListingForPush } = require("../validators/ebay.listing.validation");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function fixture() {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const [discs, pads] = await Promise.all(
    ["Brake Discs", "Brake Pads"].map((name) => Category.create({ tenant_id: tenantId, name: `${name} ${suffix}`, slug: `${name}-${suffix}` })),
  );
  const product = await Product.create({
    tenant_id: tenantId, title: `Disc ${suffix}`, slug: `disc-${suffix}`, sku: `D-${suffix}`, categories: [discs._id, pads._id],
  });
  return { tenantId, discs, pads, product };
}

async function resolveFor(listing, product, platform) {
  const resolved = resolveListing({ platform, ...listing }, product.toObject(), null);
  await hydrateResolved([resolved], registry.get(platform), product.tenant_id);
  return resolved;
}

test("category resolution: per-listing value wins over the tenant mapping", async () => {
  const { tenantId, discs, product } = await fixture();
  await service.upsertMapping(tenantId, discs._id, "ebay", { external_category_id: "33564", external_category_name: "Brake Discs" });

  const resolved = await resolveFor({ ebay_category_id: "11111" }, product, "ebay");
  assert.deepEqual(resolved.category, { id: "11111", name: null, source: "listing" });
});

test("category resolution: no listing value falls back to the tenant mapping, then to unset", async () => {
  const { tenantId, discs, product } = await fixture();

  assert.equal((await resolveFor({ google_product_category: null }, product, "google")).category, null, "unset when nothing is mapped");

  await service.upsertMapping(tenantId, discs._id, "google", { external_category_id: "2977" });
  const resolved = await resolveFor({ google_product_category: null }, product, "google");
  assert.equal(resolved.category.id, "2977");
  assert.equal(resolved.category.source, "mapping");

  const body = googleAdapter.buildProductInputFromResolved(
    { ...resolved, photos: [{ url: "https://cdn.example.com/a.jpg" }] }, { target_country: "AU" }, 1, {}, "https://shop/p",
  );
  assert.equal(body.productAttributes.googleProductCategory, "2977", "the mapped category must reach Google's payload");
});

test("category resolution: the first product category (in product order) with a mapping wins", async () => {
  const { tenantId, discs, pads, product } = await fixture();
  await service.upsertMapping(tenantId, pads._id, "ebay", { external_category_id: "222" });
  assert.equal((await resolveFor({}, product, "ebay")).category.id, "222", "only the second category is mapped");

  await service.upsertMapping(tenantId, discs._id, "ebay", { external_category_id: "111" });
  assert.equal((await resolveFor({}, product, "ebay")).category.id, "111", "the first category now has a mapping");
});

test("category mappings are tenant-scoped and upsert in place", async () => {
  const a = await fixture();
  const b = await fixture();
  await service.upsertMapping(a.tenantId, a.discs._id, "ebay", { external_category_id: "1" });
  await service.upsertMapping(a.tenantId, a.discs._id, "ebay", { external_category_id: "2" });

  const overviewA = await service.getMappingOverview(a.tenantId);
  assert.equal(overviewA.mappings.length, 1, "second upsert updates the same row");
  assert.equal(overviewA.mappings[0].external_category_id, "2");
  assert.equal((await service.getMappingOverview(b.tenantId)).mappings.length, 0);

  await assert.rejects(
    () => service.upsertMapping(b.tenantId, a.discs._id, "ebay", { external_category_id: "9" }),
    (err) => err.status === 404,
    "a tenant cannot map another tenant's category",
  );
  assert.deepEqual(await service.getMappedCategoriesForProduct(b.tenantId, a.product._id), null);
});

test("eBay push validation accepts a mapped category in place of a listing one", async () => {
  const { tenantId, discs, product } = await fixture();
  const listing = { ebay_category_id: null, photo_overrides: [] };
  assert.ok(validateListingForPush(listing, product).some((e) => e.field === "ebay_category_id"));

  await service.upsertMapping(tenantId, discs._id, "ebay", { external_category_id: "33564" });
  const categoryId = await service.resolveEffectiveCategoryId(tenantId, "ebay", null, product);
  assert.equal(categoryId, "33564");
  assert.ok(!validateListingForPush(listing, product, { categoryId }).some((e) => e.field === "ebay_category_id"));
});

test("suggestGoogleCategory: keyword match, word-bounded, with a general fallback", () => {
  assert.equal(service.suggestGoogleCategory("Brake Discs & Rotors").id, "2977");
  assert.equal(service.suggestGoogleCategory("Headlights").id, "3318");
  assert.equal(service.suggestGoogleCategory("Engine Gaskets").id, "2820", "engine-part keywords beat the generic 'engine'");
  const fallback = service.suggestGoogleCategory("Miscellaneous");
  assert.equal(fallback.id, "899");
  assert.equal(fallback.matched, false);
});
