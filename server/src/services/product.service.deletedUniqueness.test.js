// services/product.service.deletedUniqueness.test.js
// Regression guard for a live prod incident: unique indexes cover soft-deleted products, but the
// soft-delete plugin hides those rows from find/findOne, so generateNextSku/ensureUniqueSlug
// picked values a soft-deleted row still held and every insert died on a duplicate key.
// Needs a live Mongo connection. Run: node --test src/services/product.service.deletedUniqueness.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");

const { generateNextSku } = require("./product.service");
const { ensureUniqueSlug } = require("../utils/slug");
const Product = require("../models/Product");

// Unique per run so concurrent/repeat runs never collide on the real indexes.
const tenantCode = `ZZ${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
const tenant = { _id: new mongoose.Types.ObjectId(), code: tenantCode };

test.before(async () => {
  await mongoose.connect(config.mongoUri);
});

test.after(async () => {
  // deleteMany bypasses the soft-delete plugin, so this really purges the fixtures.
  await Product.deleteMany({ tenant_id: tenant._id });
  await mongoose.disconnect();
});

test("the SKU counter counts soft-deleted products — the exact prod failure", async () => {
  const live = await Product.create({
    tenant_id: tenant._id,
    title: "Live product",
    slug: `live-${tenantCode.toLowerCase()}`,
    sku: `${tenantCode}-000538`,
  });
  const deleted = await Product.create({
    tenant_id: tenant._id,
    title: "Deleted product",
    slug: `deleted-${tenantCode.toLowerCase()}`,
    sku: `${tenantCode}-000539`,
  });
  await deleted.softDelete();

  const next = await generateNextSku(tenant);

  assert.notEqual(
    next,
    `${tenantCode}-000539`,
    "handed out a SKU a soft-deleted product still holds — the insert would throw E11000",
  );
  assert.equal(next, `${tenantCode}-000540`);

  // and the value it returns must actually be insertable
  const created = await Product.create({
    tenant_id: tenant._id,
    title: "Next product",
    slug: `next-${tenantCode.toLowerCase()}`,
    sku: next,
  });
  assert.ok(created._id);
  assert.ok(live._id);
});

test("ensureUniqueSlug treats a soft-deleted product's slug as taken", async () => {
  const base = `ghost-${tenantCode.toLowerCase()}`;

  const ghost = await Product.create({
    tenant_id: tenant._id,
    title: "Ghost product",
    slug: base,
    sku: `${tenantCode}-000900`,
  });
  await ghost.softDelete();

  const slug = await ensureUniqueSlug(Product, base, null, tenant._id);

  assert.notEqual(slug, base, "reused a slug the unique index still considers taken");
  assert.equal(slug, `${base}-2`);

  const created = await Product.create({
    tenant_id: tenant._id,
    title: "Ghost product",
    slug,
    sku: `${tenantCode}-000901`,
  });
  assert.ok(created._id);
});

test("slug uniqueness stays scoped per tenant", async () => {
  // A slug taken in another tenant must not bump this tenant's — the compound index allows cross-tenant reuse.
  const otherTenant = new mongoose.Types.ObjectId();
  const base = `shared-${tenantCode.toLowerCase()}`;

  await Product.create({
    tenant_id: otherTenant,
    title: "Other tenant product",
    slug: base,
    sku: `${tenantCode}-000950`,
  });

  try {
    assert.equal(await ensureUniqueSlug(Product, base, null, tenant._id), base);
  } finally {
    await Product.deleteMany({ tenant_id: otherTenant });
  }
});
