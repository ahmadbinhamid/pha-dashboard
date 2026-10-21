require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const Tenant = require("../src/models/Tenant");
const User = require("../src/models/User");
const Location = require("../src/models/Location");
const Category = require("../src/models/Category");
const { USER_ROLE, USER_STATUS } = require("../src/constants/user.constants");
const { SYSTEM_ROLE } = require("../src/constants/access.constants");
const { seedSystemRoles } = require("../src/services/role.service");
const { addMember } = require("../src/services/membership.service");

// Every model is tenant-scoped, so the superadmin gets a default tenant.
const DEFAULT_TENANT = { name: "Parts Hub Australia", slug: "parts-hub-australia", code: "PHA" };

const LOCATIONS = [
  { name: "Main Warehouse", address: "12 Industrial Ave, Sydney NSW 2000" },
  { name: "Showroom", address: "45 High Street, Melbourne VIC 3000" },
  { name: "Storage Unit B", address: "7 Depot Road, Brisbane QLD 4000" },
];

const CATEGORIES = [
  { name: "Engine Parts", slug: "engine-parts" },
  { name: "Brakes & Rotors", slug: "brakes-rotors" },
  { name: "Suspension", slug: "suspension" },
  { name: "Electrical", slug: "electrical" },
  { name: "Body & Exterior", slug: "body-exterior" },
  { name: "Filters & Fluids", slug: "filters-fluids" },
  { name: "Transmission", slug: "transmission" },
  { name: "Exhaust", slug: "exhaust" },
];

// NOTE: the IIFE never rejects; failures exit via the catch below.
void (async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await User.syncIndexes();

    // Tenant
    let tenant = await Tenant.findOne({ slug: DEFAULT_TENANT.slug });
    if (!tenant) {
      tenant = await Tenant.create(DEFAULT_TENANT);
      console.log(`Tenant created: ${tenant.name}`);
    } else {
      console.log(`Tenant already exists: ${tenant.name}`);
    }

    // Super Admin
    const email = process.env.SUPERADMIN_EMAIL || "superadmin@xyz.com";
    const password = process.env.SUPERADMIN_PASSWORD || "dewdrops123";
    const phone = process.env.SUPERADMIN_PHONE || null;

    let user = await User.findOne({ tenant_id: tenant._id, email });
    const existing = user;
    if (existing) {
      if (existing.status !== USER_STATUS.ACTIVE) {
        existing.status = USER_STATUS.ACTIVE;
        existing.verified_at = existing.verified_at ?? new Date();
        await existing.save();
        console.log(`SuperAdmin status updated to "${USER_STATUS.ACTIVE}": ${email}`);
      } else {
        console.log(`SuperAdmin already exists: ${email}`);
      }
    } else {
      user = await User.create({
        tenant_id: tenant._id,
        first_name: "Super",
        last_name: "Admin",
        email,
        password,
        role: USER_ROLE.SUPERADMIN,
        phone,
        status: USER_STATUS.ACTIVE,
        verified_at: new Date(),
      });
      console.log(`SuperAdmin created: ${email}`);
    }

    // Membership, not User.tenant_id, grants dashboard access.
    const roles = await seedSystemRoles(tenant._id);
    await addMember({ tenantId: tenant._id, userId: user._id, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
    console.log(`SuperAdmin is Admin of: ${tenant.name}`);

    // Locations
    for (const loc of LOCATIONS) {
      const exists = await Location.findOne({ tenant_id: tenant._id, name: loc.name });
      if (!exists) {
        await Location.create({ ...loc, tenant_id: tenant._id });
        console.log(`Location created: ${loc.name}`);
      } else {
        console.log(`Location already exists: ${loc.name}`);
      }
    }

    // Categories
    for (const cat of CATEGORIES) {
      const exists = await Category.findOne({ tenant_id: tenant._id, slug: cat.slug });
      if (!exists) {
        await Category.create({ ...cat, tenant_id: tenant._id });
        console.log(`Category created: ${cat.name}`);
      } else {
        console.log(`Category already exists: ${cat.name}`);
      }
    }

  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
