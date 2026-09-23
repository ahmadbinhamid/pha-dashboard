// services/marketplace/productEdit.propagation.test.js
// A product title edit reaches both real adapters (only platform HTTP stubbed). Needs Mongo.

const test = require("node:test");
const { mock, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
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

async function makeFixture() {
  const suffix = crypto.randomUUID();
  const tenantId = new mongoose.Types.ObjectId();
  const photo = await Attachment.create({ tenant_id: tenantId, uid: `att-${suffix}`, file_name: `${suffix}.jpg`, type: "image" });
  const product = await Product.create({
    tenant_id: tenantId,
    title: `Old title ${suffix}`,
    slug: `propagation-${suffix}`,
    sku: `PROP-${suffix}`,
    price: 50,
    status: "active",
    stock_control: true,
    attachments: [photo._id],
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Loc ${suffix}` });
  await Inventory.create({ product: product._id, variant: null, location: location._id, stock_count: 3 });
  await Domain.create({
    tenant_id: tenantId,
    hostname: `store-${suffix}.example.com`,
    status: DOMAIN_STATUS.ACTIVE,
    is_default: true,
    verification_token: crypto.randomUUID(),
  });
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId,
    platform: "google",
    status: "connected",
    access_token_ct: packCiphertext(encrypt("fake-access")),
    refresh_token_ct: packCiphertext(encrypt("fake-refresh")),
    token_expires_at: new Date(Date.now() + 3600_000),
    merchant_id: "merchant123",
    data_source_id: "ds1",
    feed_label: "AU",
    content_language: "en",
    target_country: "AU",
    consecutive_failures: 0,
  });
  // No overrides; no eBay category, so update() stops after the item write.
  await MarketplaceListing.create({
    tenant_id: tenantId, product: product._id, platform: "ebay", state: "active",
    condition: "NEW", external_listing_id: `L-${suffix}`, external_offer_id: `O-${suffix}`,
  });
  await MarketplaceListing.create({ tenant_id: tenantId, product: product._id, platform: "google", state: "active", condition: "new" });
  return { tenantId, product, suffix };
}

function fakeRes() {
  return {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("editing a product title with no override reaches both the eBay and Google adapters", async () => {
  const { tenantId, product, suffix } = await makeFixture();
  const newTitle = `New title ${suffix}`;
  enqueueSpy.mock.resetCalls();
  googleInsertBodies = [];

  const res = fakeRes();
  await productController.updateProduct(
    { params: { id: product._id.toString() }, tenantId, user: { _id: new mongoose.Types.ObjectId() }, body: { title: newTitle } },
    res,
  );
  assert.equal(res.statusCode, 200);

  const jobs = enqueueSpy.mock.calls.map((c) => c.arguments).filter(([, jobName]) => jobName === "sync_listing");
  assert.deepEqual(jobs.map(([platform]) => platform).sort(), ["ebay", "google"]);

  const upsertsBefore = upsertSpy.mock.callCount();
  for (const [, , payload] of jobs) {
    const result = await syncListing(payload.listingId, payload.seq);
    assert.equal(result.ok, true, `sync must succeed: ${JSON.stringify(result)}`);
  }

  assert.equal(upsertSpy.mock.callCount(), upsertsBefore + 1);
  const ebayItem = upsertSpy.mock.calls.at(-1).arguments[2];
  assert.equal(ebayItem.product.title, newTitle, "eBay must receive the edited product title");
  assert.ok(ebayItem.product.description.includes(newTitle), "eBay's rendered description must carry the new title too");
  assert.ok(!ebayItem.product.description.includes(product.title), "no stale copy of the old title");

  assert.equal(googleInsertBodies.length, 1);
  assert.equal(googleInsertBodies[0].productAttributes.title, newTitle, "Google must receive the edited product title");
});
