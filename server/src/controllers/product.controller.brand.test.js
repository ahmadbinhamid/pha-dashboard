// controllers/product.controller.brand.test.js
// Brand saves on create and edit; an edit resyncs Meta and Google. Needs Mongo.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../config");
const { fixtureId } = require("../testUtils/fixtureTenants");

const channelQueue = require("../queues/channel.queue");
const enqueueSpy = mock.method(channelQueue, "enqueueChannelJob", async (platform) => ({ id: `fake-${platform}` }));
mock.method(require("../queues/search.queue"), "enqueueSearchJob", async () => ({ id: "fake-search" }));
require("../services/marketplace/registerAdapters").registerAdapters();

const productController = require("./product.controller");
const v = require("../validators/product.validation");
const Product = require("../models/Product");
const MarketplaceListing = require("../models/MarketplaceListing");
require("../models/Attachment");
require("../models/Category");

before(async () => {
  await mongoose.connect(config.mongoUri);
});
after(async () => {
  await mongoose.disconnect();
});

function fakeRes() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function tenantReq(tenantId, extra) {
  const code = `BR${crypto.randomUUID().slice(0, 6)}`.toUpperCase();
  return { tenantId, tenant: { _id: tenantId, code }, user: { _id: fixtureId() }, ...extra };
}

async function productWithListings(tenantId, platforms) {
  const suffix = crypto.randomUUID();
  const product = await Product.create({
    tenant_id: tenantId, title: `Brand test ${suffix}`, slug: `brand-test-${suffix}`, sku: `BT-${suffix}`, price: 10, status: "active",
  });
  for (const platform of platforms) {
    await MarketplaceListing.create({ tenant_id: tenantId, product: product._id, platform, state: "active", condition: "NEW" });
  }
  return product;
}

test("create validator accepts a brand and caps it at 100 characters", () => {
  assert.equal(v.createProduct.body.validate({ title: "Pads", brand: "Bosch" }).error, undefined);
  assert.ok(v.createProduct.body.validate({ title: "Pads", brand: "x".repeat(101) }).error);
});

test("createProduct: the brand is saved", async () => {
  const tenantId = fixtureId();
  const res = fakeRes();
  await productController.createProduct(tenantReq(tenantId, { body: { title: "Brake pads", price: "10", brand: "Ryco" } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.brand, "Ryco");
  assert.equal((await Product.findById(res.body.data._id)).brand, "Ryco");
});

test("createProduct: no brand saves null, so the store default can apply", async () => {
  const tenantId = fixtureId();
  const res = fakeRes();
  await productController.createProduct(tenantReq(tenantId, { body: { title: "Oil filter", price: "5" } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.brand, null);
});

test("updateProduct: a brand edit saves and resyncs Meta and Google listings", async () => {
  const tenantId = fixtureId();
  const product = await productWithListings(tenantId, ["meta", "google"]);
  enqueueSpy.mock.resetCalls();
  const res = fakeRes();
  await productController.updateProduct(tenantReq(tenantId, { params: { id: String(product._id) }, body: { brand: "Bosch" } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal((await Product.findById(product._id)).brand, "Bosch");
  const synced = enqueueSpy.mock.calls.filter((c) => c.arguments[1] === "sync_listing").map((c) => c.arguments[0]).sort();
  assert.deepEqual(synced, ["google", "meta"]);
});

test("updateProduct: clearing the brand saves null and resyncs; same brand does not", async () => {
  const tenantId = fixtureId();
  const product = await productWithListings(tenantId, ["meta", "google"]);
  await Product.updateOne({ _id: product._id }, { brand: "Bosch" });

  enqueueSpy.mock.resetCalls();
  const same = fakeRes();
  await productController.updateProduct(tenantReq(tenantId, { params: { id: String(product._id) }, body: { brand: "Bosch" } }), same);
  assert.equal(enqueueSpy.mock.calls.filter((c) => c.arguments[1] === "sync_listing").length, 0, "unchanged brand: no resync");

  const cleared = fakeRes();
  await productController.updateProduct(tenantReq(tenantId, { params: { id: String(product._id) }, body: { brand: "" } }), cleared);
  assert.equal(cleared.statusCode, 200);
  assert.equal((await Product.findById(product._id)).brand, null);
  assert.equal(enqueueSpy.mock.calls.filter((c) => c.arguments[1] === "sync_listing").length, 2);
});
