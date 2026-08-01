// scripts/provisionTenant.js
//
// General-purpose CLI to onboard a new client onto pha-dashboard — the
// stopgap for tenant provisioning until a dedicated admin panel exists.
// Creates the Tenant record, its first staff account (superadmin role,
// scoped to this tenant only — see feedback_service_layer / tenant-based
// system plan: no cross-tenant admin panel yet), and default categories.
//
// Usage:
//   node scripts/provisionTenant.js \
//     --name "Acme Auto Parts" --slug acme-auto-parts --code ACME \
//     --admin-email owner@acme.example --admin-password "changeme123" \
//     --admin-first-name Jane --admin-last-name Doe
//
// Safe to re-run against the same --slug: reuses the existing Tenant and
// only creates the admin user / categories if they don't already exist.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const Tenant = require("../src/models/Tenant");
const User = require("../src/models/User");
const Category = require("../src/models/Category");
const { USER_ROLE, USER_STATUS } = require("../src/constants/user.constants");

const DEFAULT_CATEGORIES = [
  { name: "Engine Parts", slug: "engine-parts" },
  { name: "Brakes & Rotors", slug: "brakes-rotors" },
  { name: "Suspension", slug: "suspension" },
  { name: "Electrical", slug: "electrical" },
  { name: "Body & Exterior", slug: "body-exterior" },
  { name: "Filters & Fluids", slug: "filters-fluids" },
  { name: "Transmission", slug: "transmission" },
  { name: "Exhaust", slug: "exhaust" },
];

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs();
  const required = ["name", "slug", "code", "admin-email", "admin-password", "admin-first-name", "admin-last-name"];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    console.error(`Missing required arguments: ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  let tenant = await Tenant.findOne({ slug: args.slug });
  if (tenant) {
    console.log(`Tenant already exists: ${tenant._id} (slug: ${args.slug})`);
  } else {
    tenant = await Tenant.create({
      name: args.name,
      slug: args.slug,
      code: args.code.toUpperCase(),
      company_name: args.name,
      email: args["admin-email"],
    });
    console.log(`Tenant created: ${tenant._id} (slug: ${args.slug}, code: ${tenant.code})`);
  }

  const existingAdmin = await User.findOne({ email: args["admin-email"], tenant_id: tenant._id });
  if (existingAdmin) {
    console.log(`Admin user already exists for this tenant: ${args["admin-email"]}`);
  } else {
    await User.create({
      tenant_id: tenant._id,
      first_name: args["admin-first-name"],
      last_name: args["admin-last-name"],
      email: args["admin-email"],
      password: args["admin-password"],
      role: USER_ROLE.SUPERADMIN,
      status: USER_STATUS.ACTIVE,
      verified_at: new Date(),
    });
    console.log(`Admin user created: ${args["admin-email"]} (role: superadmin)`);
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({ tenant_id: tenant._id, slug: cat.slug });
    if (!exists) {
      await Category.create({ ...cat, tenant_id: tenant._id });
      console.log(`Category created: ${cat.name}`);
    }
  }

  console.log(`\nDone. Tenant "${tenant.name}" (${tenant._id}) is ready — the admin can log in with ${args["admin-email"]}.`);
  console.log("Next: have them connect Stripe from Settings before taking live payments.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("provisionTenant failed:", err);
  process.exit(1);
});
