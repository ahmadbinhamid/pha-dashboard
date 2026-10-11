// services/marketplace/brand-backfill.test.js
// Brand from make: genuine/unset only, never overwrites, dry run is inert.

const test = require("node:test");
const { before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const config = require("../../config");
const { fixtureId } = require("../../testUtils/fixtureTenants");

const Product = require("../../models/Product");
const MarketplaceListing = require("../../models/MarketplaceListing");
const channelQueue = require("../../queues/channel.queue");
const searchQueue = require("../../queues/search.queue");
require("./registerAdapters").registerAdapters();
const { backfillBrandFromMake, classifyProduct, toBrandName } = require("./brand-backfill.service");
const { BRAND_BACKFILL_OUTCOME: BACKFILL_OUTCOME } = require("../../constants/product.constants");

before(async () => {
  await mongoose.connect(config.mongoUri);
});
after(async () => {
  await mongoose.disconnect();
});
afterEach(() => mock.restoreAll());

function spyQueues() {
  const jobs = [];
  mock.method(channelQueue, "enqueueChannelJob", async (platform, name, data) => jobs.push({ platform, name, data }));
  const search = mock.method(searchQueue, "enqueueSearchJob", async () => ({ id: "fake-search" }));
  return { jobs, search };
}

async function makeProduct(tenantId, fields) {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `Backfill ${suffix}`, slug: `backfill-${suffix}`, sku: `BF-${suffix}`, ...fields });
}

const listing = (tenantId, product, platform) =>
  MarketplaceListing.create({ tenant_id: tenantId, product: product._id, platform, state: "active", condition: "NEW" });

// One of each case in a fresh tenant.
async function seed() {
  const tenantId = fixtureId();
  const p = {
    genuine: await makeProduct(tenantId, { authenticity: "Genuine", brand: null, vehicle: { make: "Toyota" } }),
    genuineBlank: await makeProduct(tenantId, { authenticity: "Genuine", brand: "", vehicle: { make: " Nissan " } }),
    aftermarket: await makeProduct(tenantId, { authenticity: "Aftermarket", brand: null, vehicle: { make: "Toyota" } }),
    unset: await makeProduct(tenantId, { authenticity: null, brand: null, vehicle: { make: "honda" } }),
    branded: await makeProduct(tenantId, { authenticity: "Genuine", brand: "Denso", vehicle: { make: "Toyota" } }),
    noMake: await makeProduct(tenantId, { authenticity: "Genuine", brand: null, vehicle: { make: "  " } }),
  };
  return { tenantId, p };
}

const brandOf = async (doc) => (await Product.findById(doc._id).lean()).brand;

test("classifyProduct: genuine or unset + empty brand + make is the only SET", () => {
  const genuine = { authenticity: "Genuine", vehicle: { make: "Toyota" } };
  assert.equal(classifyProduct({ ...genuine, brand: null }), BACKFILL_OUTCOME.SET);
  assert.equal(classifyProduct({ ...genuine }), BACKFILL_OUTCOME.SET, "missing brand counts as empty");
  assert.equal(classifyProduct({ ...genuine, brand: "   " }), BACKFILL_OUTCOME.SET);
  assert.equal(classifyProduct({ ...genuine, brand: "Bosch" }), BACKFILL_OUTCOME.ALREADY_BRANDED);
  assert.equal(classifyProduct({ ...genuine, authenticity: "Aftermarket" }), BACKFILL_OUTCOME.AFTERMARKET);
  assert.equal(classifyProduct({ ...genuine, authenticity: null }), BACKFILL_OUTCOME.SET, "unset counts as genuine");
  assert.equal(classifyProduct({ ...genuine, authenticity: undefined }), BACKFILL_OUTCOME.SET);
  assert.equal(classifyProduct({ ...genuine, authenticity: "" }), BACKFILL_OUTCOME.SET);
  assert.equal(classifyProduct({ ...genuine, authenticity: "genuine" }), BACKFILL_OUTCOME.UNRECOGNISED_AUTHENTICITY, "exact value only");
  assert.equal(classifyProduct({ ...genuine, vehicle: {} }), BACKFILL_OUTCOME.NO_MAKE);
  assert.equal(classifyProduct({ ...genuine, vehicle: null }), BACKFILL_OUTCOME.NO_MAKE);
  assert.equal(classifyProduct({ ...genuine, vehicle: {}, additional_fitments: [{ make: "Lexus" }] }), BACKFILL_OUTCOME.SET);
  assert.equal(classifyProduct({ ...genuine, vehicle: {}, additional_fitments: [{ make: " " }, {}] }), BACKFILL_OUTCOME.NO_MAKE);
});

test("toBrandName: capitalises lowercase makes, keeps deliberate casing", () => {
  assert.equal(toBrandName("honda"), "Honda");
  assert.equal(toBrandName("  land   rover "), "Land Rover");
  assert.equal(toBrandName("mercedes-benz"), "Mercedes-Benz");
  assert.equal(toBrandName("BMW"), "BMW");
  assert.equal(toBrandName("McLaren"), "McLaren");
});

test("dry run: reports every bucket and writes or queues nothing", async () => {
  const { tenantId, p } = await seed();
  await listing(tenantId, p.genuine, "meta");
  const { jobs, search } = spyQueues();

  const [report] = await backfillBrandFromMake({ tenantId });
  assert.deepEqual(report.counts, { set: 3, already_branded: 1, aftermarket: 1, unrecognised_authenticity: 0, no_make: 1 });
  const expected = [[p.genuine, "Toyota"], [p.genuineBlank, "Nissan"], [p.unset, "Honda"]];
  assert.deepEqual(report.samples.set.sort(), expected.map(([d, brand]) => `${d._id} -> ${brand}`).sort(), "samples preview the brand");
  assert.equal(report.written, 0);
  assert.equal(jobs.length, 0);
  assert.equal(search.mock.calls.length, 0);
  for (const doc of Object.values(p)) assert.equal(await brandOf(doc), doc.brand, "dry run is the default and writes nothing");
});

test("confirm: sets only genuine/unset brandless parts, never overwrites, resyncs Meta/Google in batches", async () => {
  const { tenantId, p } = await seed();
  const extra = await makeProduct(tenantId, { authenticity: "Genuine", brand: null, vehicle: { make: "Mazda" } });
  const meta = await Promise.all([p.genuine, p.genuineBlank, extra].map((doc) => listing(tenantId, doc, "meta")));
  const google = await listing(tenantId, p.genuine, "google");
  const ebay = await listing(tenantId, p.genuine, "ebay");
  await listing(tenantId, p.aftermarket, "meta");
  const { jobs, search } = spyQueues();

  const savedChunk = config.channels.batchChunkSize;
  config.channels.batchChunkSize = 2;
  let report;
  try {
    [report] = await backfillBrandFromMake({ dryRun: false, tenantId });
  } finally {
    config.channels.batchChunkSize = savedChunk;
  }

  assert.equal(report.written, 4);
  assert.equal(await brandOf(p.genuine), "Toyota");
  assert.equal(await brandOf(p.genuineBlank), "Nissan", "make is trimmed");
  assert.equal(await brandOf(extra), "Mazda");
  assert.equal(await brandOf(p.aftermarket), null, "aftermarket is never branded with the vehicle make");
  assert.equal(await brandOf(p.unset), "Honda", "unset authenticity is filled, capitalised");
  assert.equal(await brandOf(p.branded), "Denso", "an existing brand is never overwritten");
  assert.equal(await brandOf(p.noMake), null);

  assert.ok(jobs.every((j) => j.name === "sync_batch"), "batched, not one job per product");
  const metaIds = jobs.filter((j) => j.platform === "meta").flatMap((j) => j.data.listingIds).sort();
  assert.deepEqual(metaIds, meta.map((l) => String(l._id)).sort(), "only the written products' Meta listings");
  assert.ok(jobs.filter((j) => j.platform === "meta").every((j) => j.data.listingIds.length <= 2), "chunked");
  assert.deepEqual(jobs.filter((j) => j.platform === "google").flatMap((j) => j.data.listingIds), [String(google._id)]);
  assert.ok(!jobs.some((j) => j.platform === "ebay" || j.data.listingIds.includes(String(ebay._id))), "eBay untouched");
  assert.equal(search.mock.calls.length, 4, "search index refreshed for each branded product");

  jobs.length = 0;
  const [again] = await backfillBrandFromMake({ dryRun: false, tenantId });
  assert.equal(again.counts.set, 0, "idempotent: a second run has nothing to do");
  assert.equal(again.written, 0);
  assert.equal(jobs.length, 0);
});

test("several vehicles: the first make in vehicle order is used (make[0])", async () => {
  const tenantId = fixtureId();
  const multi = await makeProduct(tenantId, {
    brand: null, vehicle: { make: "toyota", model: "Camry" }, additional_fitments: [{ make: "lexus" }, { make: "daihatsu" }],
  });
  const modelOnly = await makeProduct(tenantId, {
    brand: null, vehicle: { make: null, model: "Corolla" }, additional_fitments: [{ model: "Yaris" }, { make: "toyota" }],
  });
  spyQueues();
  const [report] = await backfillBrandFromMake({ dryRun: false, tenantId });
  assert.equal(report.written, 2);
  assert.equal(await brandOf(multi), "Toyota", "Vehicle 1's make wins over later vehicles");
  assert.equal(await brandOf(modelOnly), "Toyota", "Vehicle 1 has no make: the first later make is used");
});

test("a brand set between read and write is never overwritten", async () => {
  const tenantId = fixtureId();
  const doc = await makeProduct(tenantId, { authenticity: "Genuine", brand: null, vehicle: { make: "Toyota" } });
  spyQueues();
  const realBulkWrite = Product.bulkWrite.bind(Product);
  mock.method(Product, "bulkWrite", async (ops, opts) => {
    // A staff edit landing after the cursor read the product.
    await Product.collection.updateOne({ _id: doc._id }, { $set: { brand: "Bosch" } });
    return realBulkWrite(ops, opts);
  });
  const [report] = await backfillBrandFromMake({ dryRun: false, tenantId });
  assert.equal(await brandOf(doc), "Bosch");
  assert.equal(report.written, 0);
});
