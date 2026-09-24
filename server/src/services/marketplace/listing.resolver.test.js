// services/marketplace/listing.resolver.test.js
// resolveProductUrl host order, fail-loud, storefront refusal. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { trackFixtureTenant } = require("../../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const Domain = require("../../models/Domain");
const Tenant = require("../../models/Tenant");
const { DOMAIN_STATUS } = require("../../constants/domain.constants");
const { resolveProductUrl } = require("./listing.resolver");

const registry = require("./registry");
// Real google.adapter.js: its manifest.requiresStorefront is the contract.
registry.register(require("./adapters/google.adapter"));
// Minimal eBay stand-in (no requiresStorefront) avoids the real adapter's deps.
registry.register({ key: "ebay", manifest: { key: "ebay", name: "eBay" }, capabilities: {}, publish: async () => {}, update: async () => {}, end: async () => {} });

async function makeTenant(suffix) {
  return Tenant.create({
    name: `Resolver Test ${suffix}`,
    slug: `resolver-test-${suffix}`,
    code: `RT${suffix.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
  }).then(trackFixtureTenant);
}

test("resolveProductUrl: a verified default Domain wins over the linkDomain fallback", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);
  await Domain.create({
    tenant_id: tenant._id,
    hostname: `store-${suffix}.example.com`,
    status: DOMAIN_STATUS.ACTIVE,
    is_default: true,
    verification_token: crypto.randomUUID(),
  });

  // google (requiresStorefront) on purpose: the domain branch wins regardless.
  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "google");
  assert.equal(url, `https://store-${suffix}.example.com/product/widget-${suffix}`);
});

test("resolveProductUrl: for a platform WITHOUT requiresStorefront, falls back to <tenant-slug>.<linkDomain> when there is no default verified Domain", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "ebay");
  const expectedHost = `${tenant.slug.replace(/-/g, "")}.autopartspro.au`;
  assert.equal(url, `https://${expectedHost}/product/widget-${suffix}`);
});

test("resolveProductUrl: TASK 2 — a platform WITH requiresStorefront refuses the linkDomain fallback and throws, even though linkDomain IS configured", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  await assert.rejects(
    () => resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "google"),
    (err) => {
      assert.match(err.message, /No verified default domain/);
      assert.match(err.message, /Google Shopping/);
      assert.match(err.message, /claimed-and-verified/);
      return true;
    },
  );
});

test("resolveProductUrl: a non-default active Domain does NOT count — falls back to linkDomain instead (non-storefront platform)", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);
  await Domain.create({
    tenant_id: tenant._id,
    hostname: `not-default-${suffix}.example.com`,
    status: DOMAIN_STATUS.ACTIVE,
    is_default: false,
    verification_token: crypto.randomUUID(),
  });

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "ebay");
  const expectedHost = `${tenant.slug.replace(/-/g, "")}.autopartspro.au`;
  assert.equal(url, `https://${expectedHost}/product/widget-${suffix}`);
});

test("resolveProductUrl: a non-default active Domain still doesn't count for a requiresStorefront platform either — throws, not a fallback", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);
  await Domain.create({
    tenant_id: tenant._id,
    hostname: `not-default-${suffix}.example.com`,
    status: DOMAIN_STATUS.ACTIVE,
    is_default: false,
    verification_token: crypto.randomUUID(),
  });

  await assert.rejects(
    () => resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "google"),
    /No verified default domain/,
  );
});

test("resolveProductUrl: a missing slug throws, naming the SKU", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  await assert.rejects(
    () => resolveProductUrl(tenant._id, null, `SKU-${suffix}`, "google"),
    (err) => {
      assert.match(err.message, new RegExp(`SKU-${suffix}`));
      assert.match(err.message, /no slug/);
      return true;
    },
  );
});

test("resolveProductUrl: platform is required — throws a clear error when omitted, rather than silently skipping the requiresStorefront check", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  await assert.rejects(
    () => resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`),
    /platform is required/,
  );
});

test("resolveProductUrl: throws only when neither a verified default Domain nor a linkDomain fallback is available (non-storefront platform)", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = null;
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  await assert.rejects(
    () => resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "ebay"),
    /No verified default domain and no PAYMENT_LINK_DOMAIN fallback/,
  );
});

test("resolveProductUrl: an unregistered/unknown platform is treated as having no storefront requirement (falls back normally)", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "some-future-unregistered-platform");
  const expectedHost = `${tenant.slug.replace(/-/g, "")}.autopartspro.au`;
  assert.equal(url, `https://${expectedHost}/product/widget-${suffix}`);
});

test("resolveProductUrl: the generated path is exactly /product/<slug> (singular)", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);
  await Domain.create({
    tenant_id: tenant._id,
    hostname: `store-${suffix}.example.com`,
    status: DOMAIN_STATUS.ACTIVE,
    is_default: true,
    verification_token: crypto.randomUUID(),
  });

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`, "google");
  const path = new URL(url).pathname;
  assert.equal(path, `/product/widget-${suffix}`);
  assert.ok(!path.startsWith("/products/"), "must not be the old plural /products/ path");
});
