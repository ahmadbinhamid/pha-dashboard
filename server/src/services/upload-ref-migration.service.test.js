// services/upload-ref-migration.service.test.js
// Stored full upload URLs become file names; reads rebuild today's URL.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const { trackFixtureTenant } = require("../testUtils/fixtureTenants");
const Tenant = require("../models/Tenant");
const StorefrontSettings = require("../models/StorefrontSettings");
const { normalizeStoredUploadRefs } = require("./upload-ref-migration.service");
const { getCompanyProfile } = require("./tenant-settings.service");
const storefrontService = require("./storefront.service");

before(() => mongoose.connect(config.mongoUri));
after(() => mongoose.disconnect());

const LOGO = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d.png";
const HERO = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.jpg";

async function legacyTenant() {
  const suffix = crypto.randomUUID();
  const tenant = trackFixtureTenant(
    await Tenant.create({ name: `Upload refs ${suffix}`, slug: `upload-refs-${suffix}`, code: `UPR${suffix.slice(0, 6).toUpperCase()}` }),
  );
  // Raw writes bypass the setters, as rows saved before them did.
  await Tenant.collection.updateOne(
    { _id: tenant._id },
    { $set: { logo_url: `https://app.autopartspro.au/uploads/${LOGO}`, favicon_url: "https://cdn.example.com/f.ico" } },
  );
  await StorefrontSettings.collection.insertOne({
    tenant_id: tenant._id,
    hero_slides: [{ _id: new mongoose.Types.ObjectId(), title: "Sale", image_url: `https://app.autopartspro.au/uploads/${HERO}`, mobile_image_url: "" }],
  });
  return tenant;
}

test("legacy rows read on today's domain before and after the migration", async (t) => {
  const tenant = await legacyTenant();
  t.after(() => StorefrontSettings.deleteMany({ tenant_id: tenant._id }));

  assert.equal((await getCompanyProfile(tenant._id)).logo_url, `${config.uploads.url}/${LOGO}`);

  const dry = await normalizeStoredUploadRefs({ dryRun: true, tenantId: tenant._id });
  assert.deepEqual(dry, { tenants: 1, storefronts: 1, users: 0 });
  assert.match((await Tenant.findById(tenant._id).lean()).logo_url, /^https:/, "dry run wrote nothing");

  await normalizeStoredUploadRefs({ dryRun: false, tenantId: tenant._id });
  const stored = await Tenant.findById(tenant._id).lean();
  assert.equal(stored.logo_url, LOGO);
  assert.equal(stored.favicon_url, "https://cdn.example.com/f.ico", "external links untouched");
  const slide = (await StorefrontSettings.findOne({ tenant_id: tenant._id }).lean()).hero_slides[0];
  assert.equal(slide.image_url, HERO);

  assert.equal((await getCompanyProfile(tenant._id)).logo_url, `${config.uploads.url}/${LOGO}`);
  const { hero_slides } = await storefrontService.getSettings(tenant._id);
  assert.equal(hero_slides[0].image_url, `${config.uploads.url}/${HERO}`);
  assert.deepEqual(await normalizeStoredUploadRefs({ dryRun: false, tenantId: tenant._id }), { tenants: 0, storefronts: 0, users: 0 });
});

test("saving a full URL through the model stores only the file name", async () => {
  const suffix = crypto.randomUUID();
  const tenant = trackFixtureTenant(
    await Tenant.create({
      name: `Upload set ${suffix}`, slug: `upload-set-${suffix}`, code: `UPS${suffix.slice(0, 6).toUpperCase()}`,
      logo_url: `https://app.partsmanager.com.au/uploads/${LOGO}`,
    }),
  );
  assert.equal((await Tenant.findById(tenant._id).lean()).logo_url, LOGO);
});
