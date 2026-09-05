// services/marketplace/listing.resolver.test.js
//
// resolveProductUrl: host resolution order (default verified Domain first,
// then the <tenant.slug>.<linkDomain> fallback shared with payment links —
// see buildPaymentBaseUrl), the /product/<slug> (singular) path, and the
// fail-loudly behavior for a missing slug or a fully unresolvable host.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/marketplace/listing.resolver.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../../config");

require("../../models/index");
const Domain = require("../../models/Domain");
const Tenant = require("../../models/Tenant");
const { DOMAIN_STATUS } = require("../../constants/domain.constants");
const { resolveProductUrl } = require("./listing.resolver");

async function makeTenant(suffix) {
  return Tenant.create({
    name: `Resolver Test ${suffix}`,
    slug: `resolver-test-${suffix}`,
    code: `RT${suffix.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
  });
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

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`);
  assert.equal(url, `https://store-${suffix}.example.com/product/widget-${suffix}`);
});

test("resolveProductUrl: falls back to <tenant-slug>.<linkDomain> when there is no default verified Domain", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const originalLinkDomain = config.payment.linkDomain;
  config.payment.linkDomain = "autopartspro.au";
  t.after(() => {
    config.payment.linkDomain = originalLinkDomain;
  });

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`);
  const expectedHost = `${tenant.slug.replace(/-/g, "")}.autopartspro.au`;
  assert.equal(url, `https://${expectedHost}/product/widget-${suffix}`);
});

test("resolveProductUrl: a non-default active Domain does NOT count — falls back to linkDomain instead", async (t) => {
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

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`);
  const expectedHost = `${tenant.slug.replace(/-/g, "")}.autopartspro.au`;
  assert.equal(url, `https://${expectedHost}/product/widget-${suffix}`);
});

test("resolveProductUrl: a missing slug throws, naming the SKU", async (t) => {
  await mongoose.connect(config.mongoUri);
  t.after(() => mongoose.disconnect());

  const suffix = crypto.randomUUID();
  const tenant = await makeTenant(suffix);

  await assert.rejects(
    () => resolveProductUrl(tenant._id, null, `SKU-${suffix}`),
    (err) => {
      assert.match(err.message, new RegExp(`SKU-${suffix}`));
      assert.match(err.message, /no slug/);
      return true;
    },
  );
});

test("resolveProductUrl: throws only when neither a verified default Domain nor a linkDomain fallback is available", async (t) => {
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
    () => resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`),
    /No verified default domain and no PAYMENT_LINK_DOMAIN fallback/,
  );
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

  const url = await resolveProductUrl(tenant._id, `widget-${suffix}`, `SKU-${suffix}`);
  const path = new URL(url).pathname;
  assert.equal(path, `/product/widget-${suffix}`);
  assert.ok(!path.startsWith("/products/"), "must not be the old plural /products/ path");
});
