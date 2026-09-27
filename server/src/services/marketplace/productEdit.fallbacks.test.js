// services/marketplace/productEdit.fallbacks.test.js
// Condition/authenticity/vehicle edits queue a sync and reach adapters. Mongo.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

// Stubs must be installed before the modules that destructure them load.
const channelQueue = require("../../queues/channel.queue");
const enqueueSpy = mock.method(channelQueue, "enqueueChannelJob", async () => ({ id: "fake-job" }));
mock.method(require("../../queues/search.queue"), "enqueueSearchJob", async () => ({ id: "fake-search" }));

const ebayApi = require("../ebay/ebay.api.service");
mock.method(ebayApi, "credentialsConfigured", () => true);
mock.method(ebayApi, "getAccessToken", async () => "fake-ebay-token");
const upsertSpy = mock.method(ebayApi, "upsertInventoryItem", async () => ({ ok: true }));
mock.method(require("../ebay/ebay.settings.service"), "getSettings", async () => ({ sandbox: true, marketplace_id: "EBAY_AU" }));

require("../../models/index");
const Product = require("../../models/Product");
const Attachment = require("../../models/Attachment");
const Location = require("../../models/Location");
const Inventory = require("../../models/Inventory");
const Domain = require("../../models/Domain");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ChannelConnection = require("../../models/ChannelConnection");
const { encrypt, packCiphertext } = require("../../utils/crypto/tokenCipher");
const { DOMAIN_STATUS } = require("../../constants/domain.constants");
const { registerAdapters } = require("./registerAdapters");
registerAdapters();

const productController = require("../../controllers/product.controller");
const { syncListing } = require("./sync.service");

let googleInsertBodies = [];
const originalUploadsUrl = config.uploads.url;

before(async () => {
  // Google rejects non-HTTPS images; dev's UPLOADS_URL is http://localhost.
  config.uploads.url = "https://cdn.example.com/uploads";
  await mongoose.connect(config.mongoUri);
  mock.method(global, "fetch", async (url, opts) => {
    if (String(url).includes("productInputs:insert")) googleInsertBodies.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
  });
});

after(async () => {
  config.uploads.url = originalUploadsUrl;
  await mongoose.disconnect();
});

// Listings hold no condition/authenticity/fitment of their own (new default).
async function makeFixture({ ebayListing = {} } = {}) {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const photo = await Attachment.create({ tenant_id: tenantId, uid: `att-${suffix}`, file_name: `${suffix}.jpg`, type: "image" });
  const product = await Product.create({
    tenant_id: tenantId, title: `Fallback ${suffix}`, slug: `fallback-${suffix}`, sku: `FB-${suffix}`,
    price: 50, status: "active", stock_control: true, attachments: [photo._id], condition: "NEW",
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 3 });
  await Domain.create({
    tenant_id: tenantId, hostname: `store-${suffix}.example.com`, status: DOMAIN_STATUS.ACTIVE,
    is_default: true, verification_token: crypto.randomUUID(),
  });
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "google", status: "connected",
    access_token_ct: packCiphertext(encrypt("fake-access")), refresh_token_ct: packCiphertext(encrypt("fake-refresh")),
    token_expires_at: new Date(Date.now() + 3600_000), merchant_id: "merchant123", data_source_id: "ds1",
    feed_label: "AU", content_language: "en", target_country: "AU", consecutive_failures: 0,
  });
  await MarketplaceListing.create({
    tenant_id: tenantId, product: product._id, platform: "ebay", state: "active",
    external_listing_id: `L-${suffix}`, external_offer_id: `O-${suffix}`, ...ebayListing,
  });
  await MarketplaceListing.create({ tenant_id: tenantId, product: product._id, platform: "google", state: "active" });
  return { tenantId, product };
}

function fakeRes() {
  return { statusCode: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

// Edits, asserts both channels queue, runs the jobs, returns the payloads.
async function editAndSync({ tenantId, product }, body) {
  enqueueSpy.mock.resetCalls();
  googleInsertBodies = [];
  const res = fakeRes();
  await productController.updateProduct({ params: { id: product._id.toString() }, tenantId, user: { _id: fixtureId() }, body }, res);
  assert.equal(res.statusCode, 200);

  const jobs = enqueueSpy.mock.calls.map((c) => c.arguments).filter(([, name]) => name === "sync_listing");
  assert.deepEqual(jobs.map(([platform]) => platform).sort(), ["ebay", "google"], `editing ${Object.keys(body)} must queue both`);

  const upsertsBefore = upsertSpy.mock.callCount();
  for (const [, , payload] of jobs) {
    const result = await syncListing(payload.listingId, payload.seq);
    assert.equal(result.ok, true, `sync must succeed: ${JSON.stringify(result)}`);
  }
  assert.equal(upsertSpy.mock.callCount(), upsertsBefore + 1);
  return { ebayItem: upsertSpy.mock.calls.at(-1).arguments[2], googleBody: googleInsertBodies.at(-1) };
}

test("editing product condition reaches eBay and Google (no listing condition set)", async () => {
  const fixture = await makeFixture();
  const { ebayItem, googleBody } = await editAndSync(fixture, { condition: "USED" });
  assert.equal(ebayItem.condition, "USED_EXCELLENT", "eBay receives the product's condition, mapped to its enum");
  assert.equal(googleBody.productAttributes.condition, "used", "Google receives it in its own vocabulary");
});

test("a deliberate eBay condition override still wins over the product", async () => {
  const fixture = await makeFixture({ ebayListing: { condition: "NEW" } });
  const { ebayItem, googleBody } = await editAndSync(fixture, { condition: "USED" });
  assert.equal(ebayItem.condition, "NEW", "listing override kept");
  assert.equal(googleBody.productAttributes.condition, "used", "Google has no override, so follows the product");
});

test("editing product authenticity reaches eBay's aspects and description", async () => {
  const fixture = await makeFixture();
  const { ebayItem } = await editAndSync(fixture, { authenticity: "Genuine" });
  assert.deepEqual(ebayItem.product.aspects.Authenticity, ["Genuine"]);
  assert.ok(ebayItem.product.description.includes("Genuine"), "description template shows it too");
});

test("editing product vehicle reaches eBay's aspects and the description fitment table", async () => {
  const fixture = await makeFixture();
  const vehicle = { make: "Toyota", model: "Hilux", model_code: "KUN26", year_from: 2005, year_to: 2015 };
  // Sent as the product form sends it: a JSON string in the multipart body.
  const { ebayItem } = await editAndSync(fixture, { vehicle: JSON.stringify(vehicle) });
  assert.deepEqual(ebayItem.product.aspects.Make, ["Toyota"]);
  assert.deepEqual(ebayItem.product.aspects.Model, ["Hilux"]);
  const html = ebayItem.product.description;
  assert.ok(html.includes("KUN26") && html.includes("2005"), "fitment table derived from product.vehicle");
  assert.ok(!html.includes("Please contact us to verify fitment"), "not the empty-fitment placeholder");
});
