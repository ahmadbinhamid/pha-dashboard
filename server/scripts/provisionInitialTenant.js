// scripts/provisionInitialTenant.js
//
// One-off: creates the "Parts Hub Australia" Tenant record, so the existing
// single-tenant data has somewhere to be backfilled onto (see
// scripts/backfillTenantId.js, which must run AFTER this).
//
// company_name/abn/phone/bank_details/etc. are intentionally left unset here
// — they're per-tenant fields now (see Tenant.js), fill them in via
// Settings → Business Info after login instead of hardcoding them in a script.
//
// Usage: node scripts/provisionInitialTenant.js
// Safe to re-run — if a tenant with this slug already exists, prints its
// _id and exits without creating a duplicate.

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Tenant = require("../src/models/Tenant");

const SLUG = "parts-hub-australia";
const CODE = "PHA";

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const existing = await Tenant.findOne({ slug: SLUG });
  if (existing) {
    console.log(`Tenant already exists: ${existing._id} (slug: ${SLUG})`);
    await mongoose.disconnect();
    return;
  }

  const tenant = await Tenant.create({
    name: "Parts Hub Australia",
    slug: SLUG,
    code: CODE,
  });

  console.log(`Tenant created: ${tenant._id} (slug: ${SLUG}, code: ${CODE})`);
  console.log("Next: run scripts/backfillTenantId.js with this tenant _id.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("provisionInitialTenant failed:", err);
  process.exit(1);
});
