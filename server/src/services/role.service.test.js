// services/role.service.test.js
// System roles are locked; custom roles may use any permission. Needs Mongo.

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { trackFixtureTenant } = require("../testUtils/fixtureTenants");
const crypto = require("node:crypto");
const config = require("../config");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Role = require("../models/Role");
const Membership = require("../models/Membership");
const Invitation = require("../models/Invitation");
const roleService = require("./role.service");
const membershipService = require("./membership.service");
const inviteService = require("./invite.service");
const { SYSTEM_ROLE, LEGACY_OWNER_ROLE } = require("../constants/access.constants");
const { ALL_PERMISSIONS } = require("../config/permissions");

async function makeTenant(suffix) {
  return Tenant.create({
    name: `Role Test ${suffix}`,
    slug: `role-test-${suffix}`.toLowerCase(),
    code: `RT${suffix.slice(0, 6).toUpperCase()}`,
    company_name: `Role Test ${suffix}`,
  }).then(trackFixtureTenant);
}

test("roles: seeding is idempotent, and the seeded set is what it claims", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);

  try {
    const first = await roleService.seedSystemRoles(tenant._id);
    const second = await roleService.seedSystemRoles(tenant._id);

    assert.deepEqual(Object.keys(first).sort(), Object.keys(second).sort());
    assert.equal(await Role.countDocuments({ tenant_id: tenant._id, is_system: true }), 2, "Admin and Staff, no duplicates");

    assert.deepEqual([...first[SYSTEM_ROLE.ADMIN].permissions].sort(), [...ALL_PERMISSIONS].sort(), "Admin is the owner: everything");
    assert.ok(!first[SYSTEM_ROLE.STAFF].permissions.includes("users.create"), "Staff can't invite");
    assert.ok(!first[SYSTEM_ROLE.STAFF].permissions.includes("roles.update"), "or edit roles");
    assert.ok(first[SYSTEM_ROLE.STAFF].permissions.includes("products.update"), "but runs the store");
  } finally {
    await Role.deleteMany({ tenant_id: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});

test("roles: Admin is locked; Staff's permissions are editable but not its name", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);

  try {
    const roles = await roleService.seedSystemRoles(tenant._id);
    const adminId = roles[SYSTEM_ROLE.ADMIN]._id;
    const staffId = roles[SYSTEM_ROLE.STAFF]._id;

    await assert.rejects(() => roleService.updateRole(adminId, tenant._id, { permissions: ["orders.view"] }), /Admin role/);
    await assert.rejects(() => roleService.deleteRole(adminId, tenant._id), /System roles/);
    assert.equal((await roleService.getRoleById(adminId, tenant._id)).name, SYSTEM_ROLE.ADMIN, "untouched");

    const edited = await roleService.updateRole(staffId, tenant._id, { name: SYSTEM_ROLE.STAFF, permissions: ["orders.view"] });
    assert.deepEqual(edited.permissions, ["orders.view"], "Staff narrowed");
    await assert.rejects(() => roleService.updateRole(staffId, tenant._id, { name: "Crew" }), /name can't be changed/);
    await assert.rejects(() => roleService.deleteRole(staffId, tenant._id), /System roles/);
  } finally {
    await Role.deleteMany({ tenant_id: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});

test("roles: a custom role only accepts permissions from the catalogue, and can't be deleted while held", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);
  const user = await User.create({
    tenant_id: tenant._id,
    first_name: "Role",
    last_name: "Holder",
    email: `role-holder-${suffix}@example.test`,
    password: "password123",
    role: "user",
    status: "active",
  });

  try {
    await assert.rejects(
      () => roleService.createRole(tenant._id, { name: "Bad", permissions: ["orders.view", "nope.invented"] }),
      /Unknown permission/,
      "a permission outside the catalogue is refused",
    );

    const role = await roleService.createRole(tenant._id, {
      name: "Warehouse Lead",
      description: "Counts stock, can't touch pricing.",
      permissions: ["inventory.view", "inventory.update", "products.view"],
    });
    assert.equal(role.is_system, false);

    // The roles list reports how many people hold each role.
    await membershipService.addMember({ tenantId: tenant._id, userId: user._id, roleId: role._id });
    const listed = (await roleService.listRoles(tenant._id)).find((r) => String(r._id) === String(role._id));
    assert.equal(listed.members_count, 1);

    await assert.rejects(() => roleService.deleteRole(role._id, tenant._id), /assigned to 1 member/);

    // Freed up once nobody holds it.
    await membershipService.removeMember(user._id, tenant._id);
    assert.ok(await roleService.deleteRole(role._id, tenant._id));
    assert.equal(await roleService.getRoleById(role._id, tenant._id), null);
  } finally {
    await Membership.deleteMany({ user_id: user._id });
    await Role.deleteMany({ tenant_id: tenant._id });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});

test("roles: can't be deleted while a pending invitation still promises it", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);

  try {
    const role = await roleService.createRole(tenant._id, { name: "Warehouse Lead", permissions: ["inventory.view"] });
    // Only pre-change invites could name a custom role; recreate one.
    const invite = await Invitation.create({
      tenant_id: tenant._id,
      email: `invitee-${suffix}@example.test`,
      role_id: role._id,
      token_hash: inviteService.hashToken(crypto.randomBytes(32).toString("hex")),
      expires_at: new Date(Date.now() + 60_000),
      sent_at: new Date(),
    });

    await assert.rejects(() => roleService.deleteRole(role._id, tenant._id), /pending invitation/);
    await inviteService.revokeInvite({ invitationId: invite._id, tenantId: tenant._id });
    assert.ok(await roleService.deleteRole(role._id, tenant._id), "freed once revoked");
  } finally {
    await Invitation.deleteMany({ tenant_id: tenant._id });
    await Role.deleteMany({ tenant_id: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});

test("roles: migration folds old Super Admin + Admin into one Admin; dry run writes nothing", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);
  const emails = [`owner-${suffix}@example.test`, `manager-${suffix}@example.test`];

  try {
    const legacy = await Role.create({ tenant_id: tenant._id, name: LEGACY_OWNER_ROLE, permissions: ALL_PERMISSIONS, is_system: true });
    const oldAdmin = await Role.create({ tenant_id: tenant._id, name: SYSTEM_ROLE.ADMIN, permissions: ["orders.view"], is_system: true });
    const [owner, manager] = await Promise.all(
      emails.map((email) => User.create({ tenant_id: tenant._id, first_name: "M", last_name: "T", email, password: "password123", status: "active" })),
    );
    await membershipService.addMember({ tenantId: tenant._id, userId: owner._id, roleId: legacy._id });
    await membershipService.addMember({ tenantId: tenant._id, userId: manager._id, roleId: oldAdmin._id });

    const dry = await roleService.migrateTenantAdminRoles({ dryRun: true, tenantId: tenant._id });
    assert.equal(dry.results[0].moved_members, 1);
    assert.ok(await Role.exists({ _id: legacy._id, name: LEGACY_OWNER_ROLE }), "dry run changes nothing");

    await roleService.migrateTenantAdminRoles({ dryRun: false, tenantId: tenant._id });
    const systemRoles = await Role.find({ tenant_id: tenant._id, is_system: true }).lean();
    assert.deepEqual(systemRoles.map((r) => r.name), [SYSTEM_ROLE.ADMIN], "one Admin role left");
    assert.deepEqual([...systemRoles[0].permissions].sort(), [...ALL_PERMISSIONS].sort());
    assert.equal(await membershipService.isTenantAdmin(owner._id, tenant._id), true);
    assert.equal(await membershipService.isTenantAdmin(manager._id, tenant._id), true, "old Admins stay admins");
    assert.equal((await roleService.migrateTenantAdminRoles({ dryRun: false, tenantId: tenant._id })).tenants, 0, "idempotent");

    // An untouched legacy Staff role moves to the new default; edited ones stay.
    const legacyStaff = await Role.create({ tenant_id: tenant._id, name: SYSTEM_ROLE.STAFF, is_system: true, permissions: [
      "dashboard.view", "products.view", "categories.view", "inventory.view", "inventory.update", "orders.view",
      "orders.create", "payments.view", "payments.create", "customers.view", "customers.create", "listings.view", "locations.view",
    ] });
    const staffResult = (await roleService.migrateTenantAdminRoles({ dryRun: false, tenantId: tenant._id })).staff;
    assert.equal(staffResult.updated, 1);
    assert.deepEqual((await Role.findById(legacyStaff._id)).permissions.sort(), [...roleService.STAFF_DEFAULT_PERMISSIONS].sort());
  } finally {
    await Membership.deleteMany({ tenant_id: tenant._id });
    await Role.deleteMany({ tenant_id: tenant._id });
    await User.deleteMany({ email: { $in: emails } });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});
