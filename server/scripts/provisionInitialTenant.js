// scripts/provisionInitialTenant.js
//
// One-off: creates the "Parts Hub Australia" Tenant record, seeded from the
// values that used to be hardcoded in constants/company.constants.js, so the
// existing single-tenant data has somewhere to be backfilled onto (see
// scripts/backfillTenantId.js, which must run AFTER this).
//
// Usage: node scripts/provisionInitialTenant.js
// Safe to re-run — if a tenant with this slug already exists, prints its
// _id and exits without creating a duplicate.

require("dotenv").config();

const mongoose = require("mongoose");
const config = require("../src/config");
const Tenant = require("../src/models/Tenant");
const { COMPANY_INFO, PICKUP_LOCATION, BANK_DETAILS, WARRANTY_TEXT, LEGAL_DISCLAIMER_TEXT } = require("../src/constants/company.constants");

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
    name: COMPANY_INFO.name,
    slug: SLUG,
    code: CODE,
    company_name: COMPANY_INFO.name,
    abn: COMPANY_INFO.abn,
    phone: COMPANY_INFO.phone,
    email: COMPANY_INFO.email,
    bank_details: {
      bank_name: BANK_DETAILS.bankName,
      account_name: BANK_DETAILS.accountName,
      bsb: BANK_DETAILS.bsb,
      account_number: BANK_DETAILS.accountNumber,
    },
    pickup_location: {
      name: PICKUP_LOCATION.name,
      address: PICKUP_LOCATION.address,
      country: PICKUP_LOCATION.country,
      trading_hours: PICKUP_LOCATION.tradingHours,
    },
    warranty_text: WARRANTY_TEXT,
    legal_disclaimer_text: LEGAL_DISCLAIMER_TEXT,
  });

  console.log(`Tenant created: ${tenant._id} (slug: ${SLUG}, code: ${CODE})`);
  console.log("Next: run scripts/backfillTenantId.js with this tenant _id.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("provisionInitialTenant failed:", err);
  process.exit(1);
});
