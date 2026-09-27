// services/marketplace/listingOverride.backfill.test.js
// Backfill clears copies, keeps real overrides, honours --dry-run. Needs Mongo.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { fixtureId } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const Product = require("../../models/Product");
const Attachment = require("../../models/Attachment");
const MarketplaceListing = require("../../models/MarketplaceListing");
const { run } = require("../../../scripts/backfillClearCopiedOverrides");
const { renderEbayDescription, descriptionInputFromResolved } = require("../ebay/ebay.description.template");

const quiet = () => {};

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

async function makeProduct(tenantId, suffix) {
  const photo = await Attachment.create({ tenant_id: tenantId, uid: `bf-${suffix}`, file_name: `${suffix}.jpg` });
  return Product.create({
    tenant_id: tenantId,
    title: `Brake Disc ${suffix}`,
    description: `Plain description ${suffix}`,
    slug: `bf-${suffix}`,
    sku: `BF-${suffix}`,
    price: 120,
    attachments: [photo._id],
  });
}

function listingFor(product, platform, fields) {
  return MarketplaceListing.create({ tenant_id: product.tenant_id, product: product._id, platform, ...fields });
}

test("backfill: an override equal to the product value is cleared by the script", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const product = await makeProduct(tenantId, suffix);
  const listing = await listingFor(product, "ebay", {
    title_override: product.title,
    price_override: product.price,
    photo_overrides: product.attachments,
  });

  const result = await run({ tenantId, log: quiet });

  assert.deepEqual(result.cleared, { title_override: 1, description_override: 0, price_override: 1, photo_overrides: 1 });
  const after = await MarketplaceListing.findById(listing._id).lean();
  assert.equal(after.title_override, null);
  assert.equal(after.price_override, null);
  assert.deepEqual(after.photo_overrides, []);
  assert.deepEqual(result.after, { title_override: 0, description_override: 0, price_override: 0, photo_overrides: 0 });

  const rerun = await run({ tenantId, log: quiet });
  assert.equal(rerun.listingsTouched, 0, "re-running must be a no-op");
});

test("backfill: a genuinely different override is preserved", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const product = await makeProduct(tenantId, suffix);
  const otherPhoto = await Attachment.create({ tenant_id: tenantId, uid: `bf-other-${suffix}`, file_name: `o-${suffix}.jpg` });
  const listing = await listingFor(product, "google", {
    title_override: `${product.title} — eBay special`,
    description_override: "Hand-written channel copy",
    price_override: 99.5,
    photo_overrides: [otherPhoto._id],
  });

  const result = await run({ tenantId, log: quiet });

  assert.equal(result.listingsTouched, 0);
  const after = await MarketplaceListing.findById(listing._id).lean();
  assert.equal(after.title_override, `${product.title} — eBay special`);
  assert.equal(after.description_override, "Hand-written channel copy");
  assert.equal(after.price_override, 99.5);
  assert.deepEqual(after.photo_overrides.map(String), [String(otherPhoto._id)]);
});

test("backfill: --dry-run reports what it would clear but writes nothing", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const product = await makeProduct(tenantId, suffix);
  const listing = await listingFor(product, "google", { title_override: product.title, description_override: product.description });

  const result = await run({ dryRun: true, tenantId, log: quiet });

  assert.equal(result.cleared.title_override, 1);
  assert.equal(result.cleared.description_override, 1);
  assert.equal(result.after.title_override, 0, "projected after-count");
  const after = await MarketplaceListing.findById(listing._id).lean();
  assert.equal(after.title_override, product.title, "dry run must not write");
});

test("backfill: a generated eBay description is only cleared with --include-generated-descriptions", async () => {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  const product = await makeProduct(tenantId, suffix);
  const generated = renderEbayDescription(descriptionInputFromResolved({ title: product.title, listing: {}, product, photos: [] }));
  const listing = await listingFor(product, "ebay", { description_override: generated });

  const without = await run({ tenantId, log: quiet });
  assert.equal(without.cleared.description_override, 0);

  const withFlag = await run({ tenantId, includeGeneratedDescriptions: true, log: quiet });
  assert.equal(withFlag.cleared.description_override, 1);
  assert.equal((await MarketplaceListing.findById(listing._id).lean()).description_override, null);
});
