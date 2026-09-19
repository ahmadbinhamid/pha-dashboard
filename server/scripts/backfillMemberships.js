require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const config = require("../src/config");
const User = require("../src/models/User");
const Tenant = require("../src/models/Tenant");
const Membership = require("../src/models/Membership");
const { seedSystemRoles } = require("../src/services/role.service");
const { SYSTEM_ROLE } = require("../src/constants/access.constants");
const { USER_ROLE } = require("../src/constants/user.constants");

/**
 * Backfills the membership model onto data that predates it.
 *
 * Access used to come from `User.tenant_id` plus a three-value `User.role`
 * enum; it now comes from a Membership row carrying a per-organisation Role
 * (see models/Membership.js). This gives every tenant its system roles and
 * every existing user a membership of the tenant they were stamped with,
 * mapping their old role across:
 *
 *   superadmin -> Super Admin      admin -> Admin      user -> Staff
 *
 * Idempotent and additive: it creates nothing that already exists and deletes
 * nothing, so it is safe to re-run, and `User.tenant_id`/`User.role` are left
 * in place as the fallback the auth layer still honours for any account this
 * hasn't reached.
 *
 * Usage:
 *   node scripts/backfillMemberships.js --dry-run
 *   node scripts/backfillMemberships.js
 */

const LEGACY_ROLE_TO_SYSTEM_ROLE = {
  [USER_ROLE.SUPERADMIN]: SYSTEM_ROLE.SUPER_ADMIN,
  [USER_ROLE.ADMIN]: SYSTEM_ROLE.ADMIN,
  [USER_ROLE.USER]: SYSTEM_ROLE.STAFF,
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(config.mongoUri);

  const users = await User.find({ tenant_id: { $ne: null } }).select("_id email role tenant_id created_at").lean();
  const tenantIds = [...new Set(users.map((u) => String(u.tenant_id)))];

  console.log(`${dryRun ? "[dry run] " : ""}${users.length} user(s) across ${tenantIds.length} tenant(s) to consider.\n`);

  let rolesSeeded = 0;
  let membershipsCreated = 0;
  let skipped = 0;

  for (const tenantId of tenantIds) {
    const tenant = await Tenant.findById(tenantId).select("name company_name").lean();
    const tenantUsers = users.filter((u) => String(u.tenant_id) === tenantId);

    let roles;
    if (dryRun) {
      // Report what seeding would do without writing.
      const { SYSTEM_ROLE_DEFINITIONS } = require("../src/services/role.service");
      const existing = await mongoose.connection
        .collection("roles")
        .find({ tenant_id: new mongoose.Types.ObjectId(tenantId), is_system: true })
        .toArray();
      const missing = SYSTEM_ROLE_DEFINITIONS.filter((d) => !existing.some((e) => e.name === d.name));
      rolesSeeded += missing.length;
      roles = Object.fromEntries(existing.map((r) => [r.name, r]));
    } else {
      const before = await Membership.db.collection("roles").countDocuments({
        tenant_id: new mongoose.Types.ObjectId(tenantId),
        is_system: true,
      });
      roles = await seedSystemRoles(tenantId);
      rolesSeeded += Object.keys(roles).length - before;
    }

    for (const user of tenantUsers) {
      const existing = await Membership.findOne({ tenant_id: tenantId, user_id: user._id }).lean();
      if (existing) {
        skipped += 1;
        continue;
      }

      const roleName = LEGACY_ROLE_TO_SYSTEM_ROLE[user.role] ?? SYSTEM_ROLE.STAFF;
      const role = roles[roleName];

      console.log(
        `  ${dryRun ? "would add" : "adding"}  ${user.email}  ->  ${tenant?.company_name || tenant?.name || tenantId}  as ${roleName}`,
      );

      if (!dryRun) {
        const hasDefault = await Membership.exists({ user_id: user._id, is_default: true });
        await Membership.create({
          tenant_id: tenantId,
          user_id: user._id,
          role_id: role._id,
          is_default: !hasDefault,
          joined_at: user.created_at || new Date(),
        });
      }
      membershipsCreated += 1;
    }
  }

  console.log(
    `\n${dryRun ? "[dry run] " : ""}system roles ${dryRun ? "to seed" : "seeded"}: ${rolesSeeded}` +
      `  |  memberships ${dryRun ? "to create" : "created"}: ${membershipsCreated}` +
      `  |  already present: ${skipped}`,
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
