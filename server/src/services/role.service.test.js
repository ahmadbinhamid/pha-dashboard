// services/role.service.test.js
//
// System roles are the safety net: a tenant can always get back into its own
// settings, so they can't be edited away or deleted. Custom roles can be
// anything the catalogue allows — and nothing it doesn't.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/role.service.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
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
const { SYSTEM_ROLE } = require("../constants/access.constants");
const { ALL_PERMISSIONS } = require("../config/permissions");

async function makeTenant(suffix) {
  return Tenant.create({
    name: `Role Test ${suffix}`,
    slug: `role-test-${suffix}`.toLowerCase(),
    code: `RT${suffix.slice(0, 6).toUpperCase()}`,
    company_name: `Role Test ${suffix}`,
  });
}

test("roles: seeding is idempotent, and the seeded set is what it claims", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);

  try {
    const first = await roleService.seedSystemRoles(tenant._id);
    const second = await roleService.seedSystemRoles(tenant._id);

    assert.deepEqual(Object.keys(first).sort(), Object.keys(second).sort());
    assert.equal(await Role.countDocuments({ tenant_id: tenant._id, is_system: true }), 3, "no duplicates on re-run");

    assert.deepEqual(
      [...first[SYSTEM_ROLE.SUPER_ADMIN].permissions].sort(),
      [...ALL_PERMISSIONS].sort(),
      "Super Admin lists the whole catalogue",
    );
    assert.ok(
      !first[SYSTEM_ROLE.ADMIN].permissions.includes("roles.update"),
      "Admin can't redefine what roles may do",
    );
    assert.ok(first[SYSTEM_ROLE.ADMIN].permissions.includes("users.create"), "Admin can still invite");
    assert.ok(!first[SYSTEM_ROLE.STAFF].permissions.includes("settings.update"), "Staff stays out of settings");
    assert.ok(first[SYSTEM_ROLE.STAFF].permissions.includes("orders.create"), "Staff can still sell");
  } finally {
    await Role.deleteMany({ tenant_id: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});

test("roles: system roles resist edits and deletion", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await makeTenant(suffix);

  try {
    const roles = await roleService.seedSystemRoles(tenant._id);
    const adminId = roles[SYSTEM_ROLE.ADMIN]._id;

    await assert.rejects(() => roleService.updateRole(adminId, tenant._id, { name: "Renamed" }), /System roles/);
    await assert.rejects(() => roleService.deleteRole(adminId, tenant._id), /System roles/);
    assert.equal((await roleService.getRoleById(adminId, tenant._id)).name, SYSTEM_ROLE.ADMIN, "untouched");
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
    const role = await roleService.createRole(tenant._id, {
      name: "Warehouse Lead",
      permissions: ["inventory.view"],
    });

    await inviteService.sendInvite({ tenantId: tenant._id, email: `invitee-${suffix}@example.test`, roleId: role._id });

    await assert.rejects(
      () => roleService.deleteRole(role._id, tenant._id),
      /pending invitation/,
      "a role a pending invite points at can't be deleted out from under it",
    );

    // Revoking the invite frees the role up again — no orphaned reference left behind.
    const invite = await Invitation.findOne({ tenant_id: tenant._id, role_id: role._id });
    await inviteService.revokeInvite({ invitationId: invite._id, tenantId: tenant._id });
    assert.ok(await roleService.deleteRole(role._id, tenant._id));
  } finally {
    await Invitation.deleteMany({ tenant_id: tenant._id });
    await Role.deleteMany({ tenant_id: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await mongoose.disconnect();
  }
});
