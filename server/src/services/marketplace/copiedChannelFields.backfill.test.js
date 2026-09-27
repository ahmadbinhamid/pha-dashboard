// services/marketplace/copiedChannelFields.backfill.test.js
// Backfill clears copied condition/authenticity/fitment, keeps real. Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const config = require("../../config");

require("../../models/index");
const Product = require("../../models/Product");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { run } = require("../../../scripts/backfillClearCopiedChannelFields");

const quiet = () => {};
const VEHICLE = { make: "Toyota", model: "Hilux", model_code: "KUN26", year_from: 2005, year_to: 2015 };

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function makeProduct(tenantId, fields) {
  const suffix = crypto.randomUUID();
  return Product.create({ tenant_id: tenantId, title: `BF ${suffix}`, slug: `bf-${suffix}`, sku: `BF-${suffix}`, ...fields });
}

// Raw insert keeps old listings' stored shape; one product each (unique index).
async function listing(productFields, tenantId, platform, fields) {
  const product = await makeProduct(tenantId, productFields);
  const { insertedId } = await MarketplaceListing.collection.insertOne({
    tenant_id: product.tenant_id, product: product._id, variant: null, platform, state: "active",
    external_listing_id: `L-${crypto.randomUUID()}`, deleted_at: null, ...fields,
  });
  return insertedId;
}

const read = (id) => MarketplaceListing.collection.findOne({ _id: id });

test("backfill: copies are cleared, real overrides kept, ambiguous NEW reported not guessed", async () => {
  const tenantId = fixtureId();
  const used = { condition: "USED", authenticity: "Genuine", vehicle: VEHICLE };

  const copyAll = await listing(used, tenantId, "ebay", {
    condition: "USED_EXCELLENT", item_specifics: { authenticity: "Genuine" }, fitment: [{ ...VEHICLE, _id: new mongoose.Types.ObjectId() }],
  });
  const realOverride = await listing(used, tenantId, "ebay", {
    condition: "USED_GOOD", item_specifics: { authenticity: "Aftermarket" }, fitment: [{ ...VEHICLE, model: "Prado" }],
  });
  const ambiguous = await listing(used, tenantId, "ebay", { condition: "NEW", item_specifics: {}, fitment: [] });
  const googleCopy = await listing(used, tenantId, "google", { condition: "used" });
  const twoRows = await listing(used, tenantId, "ebay", { condition: null, fitment: [VEHICLE, { ...VEHICLE, year_to: 2020 }] });

  const dry = await run({ tenantId, dryRun: true, log: quiet });
  assert.deepEqual(dry.cleared, { ebay_condition: 1, google_condition: 1, authenticity: 1, fitment: 1 });
  assert.equal((await read(copyAll)).condition, "USED_EXCELLENT", "dry run writes nothing");

  const result = await run({ tenantId, log: quiet });
  assert.deepEqual(result.cleared, dry.cleared, "dry run projected exactly what ran");
  const cleared = await read(copyAll);
  assert.equal(cleared.condition, null);
  assert.equal(cleared.item_specifics.authenticity, null);
  assert.deepEqual(cleared.fitment, []);
  assert.equal((await read(googleCopy)).condition, null);

  const kept = await read(realOverride);
  assert.equal(kept.condition, "USED_GOOD", "a different condition is a real override");
  assert.equal(kept.item_specifics.authenticity, "Aftermarket");
  assert.equal(kept.fitment.length, 1);
  assert.equal((await read(twoRows)).fitment.length, 2, "only a single exact-match row is a copy");

  assert.equal((await read(ambiguous)).condition, "NEW", "ambiguous default is left alone");
  assert.equal(result.ambiguous.count, 1);
  assert.deepEqual(result.ambiguous.sample, [String(ambiguous)]);

  const rerun = await run({ tenantId, log: quiet });
  assert.deepEqual(rerun.cleared, { ebay_condition: 0, google_condition: 0, authenticity: 0, fitment: 0 }, "idempotent");
});

test("backfill: a NEW listing on a NEW product is a plain copy, not ambiguous", async () => {
  const tenantId = fixtureId();
  const id = await listing({ condition: "NEW" }, tenantId, "ebay", { condition: "NEW", item_specifics: {}, fitment: [] });

  const result = await run({ tenantId, log: quiet });
  assert.equal(result.cleared.ebay_condition, 1);
  assert.equal(result.ambiguous.count, 0);
  assert.equal((await read(id)).condition, null, "pushes the same NEW either way");
});
