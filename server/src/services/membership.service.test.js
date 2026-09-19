// services/membership.service.test.js
//
// The rules the whole access model rests on: a person can hold several
// organisations at once with a different role in each; permissions only ever
// come from an ACTIVE membership; and leaving one organisation never touches
// the account or the others.
//
// Needs a live Mongo connection — run with:
//   node --test src/services/membership.service.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const config = require("../config");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Role = require("../models/Role");
const Membership = require("../models/Membership");
const roleService = require("./role.service");
const membershipService = require("./membership.service");
const { SYSTEM_ROLE, MEMBERSHIP_STATUS } = require("../constants/access.constants");

async function makeTenant(suffix, label) {
  return Tenant.create({
    name: `Test ${label} ${suffix}`,
    slug: `test-${label}-${suffix}`.toLowerCase(),
    code: `T${suffix.slice(0, 6).toUpperCase()}${label[0].toUpperCase()}`,
    company_name: `Test ${label} ${suffix}`,
  });
}

async function makeUser(suffix, tenantId) {
  return User.create({
    tenant_id: tenantId,
    first_name: "Member",
    last_name: "Test",
    email: `member-${suffix}@example.test`,
    password: "password123",
    role: "user",
    status: "active",
  });
}

test("membership: one user, two organisations, a different role in each", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);

  const orgA = await makeTenant(suffix, "alpha");
  const orgB = await makeTenant(suffix, "beta");
  const user = await makeUser(suffix, orgA._id);

  try {
    const rolesA = await roleService.seedSystemRoles(orgA._id);
    const rolesB = await roleService.seedSystemRoles(orgB._id);

    await membershipService.addMember({ tenantId: orgA._id, userId: user._id, roleId: rolesA[SYSTEM_ROLE.ADMIN]._id });
    await membershipService.addMember({ tenantId: orgB._id, userId: user._id, roleId: rolesB[SYSTEM_ROLE.STAFF]._id });

    const memberships = await membershipService.listUserMemberships(user._id);
    assert.equal(memberships.length, 2, "belongs to both organisations");

    // First organisation joined is the one the dashboard opens on.
    const defaults = memberships.filter((m) => m.is_default);
    assert.equal(defaults.length, 1, "exactly one default");
    assert.equal(String(defaults[0].tenant_id._id), String(orgA._id));

    // The role is per-organisation, not per-account.
    assert.equal(await membershipService.hasPermission(user._id, orgA._id, "settings.update"), true, "Admin in A");
    assert.equal(await membershipService.hasPermission(user._id, orgB._id, "settings.update"), false, "Staff in B");
    assert.equal(await membershipService.hasPermission(user._id, orgB._id, "orders.create"), true, "Staff can still sell in B");

    // Joining twice is a no-op, not a duplicate or an error.
    await membershipService.addMember({ tenantId: orgA._id, userId: user._id, roleId: rolesA[SYSTEM_ROLE.STAFF]._id });
    assert.equal(await Membership.countDocuments({ user_id: user._id, tenant_id: orgA._id }), 1);
    assert.equal(await membershipService.hasPermission(user._id, orgA._id, "settings.update"), true, "role unchanged by re-add");

    // Suspension removes access without deleting the record.
    await membershipService.updateMember(user._id, orgA._id, { status: MEMBERSHIP_STATUS.SUSPENDED });
    assert.equal(await membershipService.hasPermission(user._id, orgA._id, "settings.update"), false, "suspended has nothing");
    assert.deepEqual(await membershipService.getPermissions(user._id, orgA._id), [], "suspended grants no permissions");
    await membershipService.updateMember(user._id, orgA._id, { status: MEMBERSHIP_STATUS.ACTIVE });
    assert.equal(await membershipService.hasPermission(user._id, orgA._id, "settings.update"), true, "restored");

    // Leaving one organisation leaves the account and the other membership.
    await membershipService.removeMember(user._id, orgA._id);
    const remaining = await membershipService.listUserMemberships(user._id);
    assert.equal(remaining.length, 1, "still in the other organisation");
    assert.equal(String(remaining[0].tenant_id._id), String(orgB._id));
    assert.equal(remaining[0].is_default, true, "the survivor takes over as default");
    assert.ok(await User.findById(user._id), "the account itself survives");
  } finally {
    await Membership.deleteMany({ user_id: user._id });
    await Role.deleteMany({ tenant_id: { $in: [orgA._id, orgB._id] } });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
    await mongoose.disconnect();
  }
});

test("membership: Super Admin is protected and short-circuits permission checks", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);

  const org = await makeTenant(suffix, "gamma");
  const owner = await makeUser(`owner-${suffix}`, org._id);

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    await membershipService.addMember({ tenantId: org._id, userId: owner._id, roleId: roles[SYSTEM_ROLE.SUPER_ADMIN]._id });

    // Holds a permission that no role lists explicitly.
    await Role.updateOne({ _id: roles[SYSTEM_ROLE.SUPER_ADMIN]._id }, { $set: { permissions: [] } });
    assert.equal(
      await membershipService.hasPermission(owner._id, org._id, "roles.delete"),
      true,
      "Super Admin passes regardless of its stored permission list",
    );

    await assert.rejects(
      () => membershipService.updateMember(owner._id, org._id, { roleId: roles[SYSTEM_ROLE.STAFF]._id }),
      /Super Admin/,
      "cannot be demoted",
    );
    await assert.rejects(() => membershipService.removeMember(owner._id, org._id), /Super Admin/, "cannot be removed");
  } finally {
    await Membership.deleteMany({ user_id: owner._id });
    await Role.deleteMany({ tenant_id: org._id });
    await User.deleteOne({ _id: owner._id });
    await Tenant.deleteOne({ _id: org._id });
    await mongoose.disconnect();
  }
});

test("membership: a member of one organisation has nothing in another", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);

  const mine = await makeTenant(suffix, "mine");
  const theirs = await makeTenant(suffix, "theirs");
  const user = await makeUser(`iso-${suffix}`, mine._id);

  try {
    const roles = await roleService.seedSystemRoles(mine._id);
    await roleService.seedSystemRoles(theirs._id);
    await membershipService.addMember({ tenantId: mine._id, userId: user._id, roleId: roles[SYSTEM_ROLE.SUPER_ADMIN]._id });

    assert.equal(await membershipService.hasPermission(user._id, theirs._id, "dashboard.view"), false);
    assert.deepEqual(await membershipService.getPermissions(user._id, theirs._id), []);
    assert.equal(await membershipService.getMembership(user._id, theirs._id), null);
  } finally {
    await Membership.deleteMany({ user_id: user._id });
    await Role.deleteMany({ tenant_id: { $in: [mine._id, theirs._id] } });
    await User.deleteOne({ _id: user._id });
    await Tenant.deleteMany({ _id: { $in: [mine._id, theirs._id] } });
    await mongoose.disconnect();
  }
});
