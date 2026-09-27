// services/invite.service.test.js
// Set-password links, existing accounts and resend rules. Needs Mongo.

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
const { comparePassword } = require("../utils/auth/crypto");
const { SYSTEM_ROLE, INVITE_STATUS } = require("../constants/access.constants");
const { USER_STATUS } = require("../constants/user.constants");

async function makeTenant(suffix, label = "inv") {
  return Tenant.create({
    name: `Invite ${label} ${suffix}`,
    slug: `invite-${label}-${suffix}`.toLowerCase(),
    code: `IV${label[0].toUpperCase()}${suffix.slice(0, 5).toUpperCase()}`,
    company_name: `Invite ${label} ${suffix}`,
  }).then(trackFixtureTenant);
}

async function makeUser(email, tenantId) {
  return User.create({ tenant_id: tenantId, first_name: "Invite", last_name: "Tester", email, password: "password123", role: "user", status: "active" });
}

async function cleanup({ tenants = [], emails = [] }) {
  const tenantIds = tenants.map((t) => t._id);
  await Invitation.deleteMany({ tenant_id: { $in: tenantIds } });
  await Membership.deleteMany({ tenant_id: { $in: tenantIds } });
  await Role.deleteMany({ tenant_id: { $in: tenantIds } });
  await User.deleteMany({ email: { $in: emails } });
  await Tenant.deleteMany({ _id: { $in: tenantIds } });
  await mongoose.disconnect();
}

// Moves sent_at back so the resend cooldown has passed.
const pastCooldown = (invitationId) =>
  Invitation.updateOne({ _id: invitationId }, { $set: { sent_at: new Date(Date.now() - (config.invites.resendCooldownSeconds + 5) * 1000) } });

test("invite: a new email gets a pending Staff account and a single-use set-password link", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix);
  const email = `newbie-${suffix}@example.test`;

  try {
    const result = await inviteService.inviteUser({ tenantId: org._id, firstName: "New", lastName: "Bie", email: email.toUpperCase() });
    assert.equal(result.mode, "invited");
    assert.equal(result.invitation.email, email, "address is normalised");
    assert.ok(result.token.length >= 32);

    const pending = await User.findOne({ email }).lean();
    assert.equal(pending.status, USER_STATUS.INVITED, "can't log in yet");
    const membership = await membershipService.getMembership(pending._id, org._id);
    assert.equal(membership.role_id.name, SYSTEM_ROLE.STAFF, "joins as Staff");

    const stored = await Invitation.findById(result.invitation._id).select("+token_hash").lean();
    assert.equal(stored.token_hash, inviteService.hashToken(result.token), "only the hash is stored");
    const hours = (new Date(stored.expires_at) - Date.now()) / 3_600_000;
    assert.ok(Math.abs(hours - config.invites.expiryHours) < 0.1, "expires after the configured hours");

    const preview = await inviteService.getInvitePreview(result.token);
    assert.equal(preview.needs_password, true);
    assert.equal(preview.first_name, "New");

    await inviteService.activateInvite(result.token, "a-new-password");
    const active = await User.findOne({ email }).select("+password");
    assert.equal(active.status, USER_STATUS.ACTIVE);
    assert.ok(await comparePassword("a-new-password", active.password), "the chosen password works");
    assert.equal((await Invitation.findById(result.invitation._id)).status, INVITE_STATUS.ACCEPTED);

    await assert.rejects(() => inviteService.activateInvite(result.token, "another-pass"), /expired or was already used/);
    await assert.rejects(() => inviteService.inviteUser({ tenantId: org._id, firstName: "N", lastName: "B", email }), /already a member/);
  } finally {
    await cleanup({ tenants: [org], emails: [email] });
  }
});

test("invite: an existing account joins directly, with no password link and its password untouched", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const home = await makeTenant(suffix, "home");
  const other = await makeTenant(suffix, "other");
  const email = `existing-${suffix}@example.test`;

  try {
    const user = await makeUser(email, home._id);
    const before = (await User.findById(user._id).select("+password")).password;

    const result = await inviteService.inviteUser({ tenantId: other._id, firstName: "X", lastName: "Y", email });
    assert.equal(result.mode, "added");
    assert.equal(result.token, undefined, "no link that could reset their password");
    assert.equal(await Invitation.countDocuments({ tenant_id: other._id }), 0);
    assert.equal((await User.findById(user._id).select("+password")).password, before, "password unchanged");
    assert.equal((await membershipService.getMembership(user._id, other._id)).role_id.name, SYSTEM_ROLE.STAFF);
  } finally {
    await cleanup({ tenants: [home, other], emails: [email] });
  }
});

test("invite: resend waits out the cooldown, kills the old link; revoke removes the pending account", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix, "resend");
  const email = `resend-${suffix}@example.test`;

  try {
    const first = await inviteService.inviteUser({ tenantId: org._id, firstName: "Re", lastName: "Send", email });
    const id = first.invitation._id;

    await assert.rejects(
      () => inviteService.resendInvite({ invitationId: id, tenantId: org._id }),
      (err) => err.status === 429 && err.retry_after > 0,
      "too soon",
    );

    await pastCooldown(id);
    const second = await inviteService.resendInvite({ invitationId: id, tenantId: org._id });
    assert.ok(second.pendingUser, "resend knows it's a set-password invite");
    assert.equal(await inviteService.findOpenInviteByToken(first.token), null, "old link is dead");
    assert.ok(await inviteService.findOpenInviteByToken(second.token), "new link works");
    assert.equal(await Invitation.countDocuments({ tenant_id: org._id, email }), 1, "one row per address");

    // Expired links are dead; a resend revives them.
    await Invitation.updateOne({ _id: id }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    await assert.rejects(() => inviteService.activateInvite(second.token, "password-123"), /expired/);

    await inviteService.revokeInvite({ invitationId: id, tenantId: org._id });
    assert.equal(await User.countDocuments({ email }), 0, "never-activated account is removed");
    assert.equal(await Membership.countDocuments({ tenant_id: org._id }), 0);
  } finally {
    await cleanup({ tenants: [org], emails: [email] });
  }
});

test("invite: the Admin picks a role; the Admin role itself can't be granted", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix, "role");
  const email = `picked-${suffix}@example.test`;

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    const lead = await roleService.createRole(org._id, { name: "Warehouse Lead", permissions: ["inventory.view"] });
    await assert.rejects(
      () => inviteService.inviteUser({ tenantId: org._id, firstName: "A", lastName: "B", email, roleId: roles[SYSTEM_ROLE.ADMIN]._id }),
      /Admin role/,
    );
    const result = await inviteService.inviteUser({ tenantId: org._id, firstName: "A", lastName: "B", email, roleId: lead._id });
    assert.equal((await membershipService.getMembership(result.user._id, org._id)).role_id.name, "Warehouse Lead");
    await assert.rejects(
      () => membershipService.updateMember(result.user._id, org._id, { roleId: roles[SYSTEM_ROLE.ADMIN]._id }),
      /Admin role/,
      "can't be promoted to Admin either",
    );
  } finally {
    await cleanup({ tenants: [org], emails: [email] });
  }
});

test("invite: old-style links sent before this change still register", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix, "legacy");
  const email = `legacy-${suffix}@example.test`;

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    const token = crypto.randomBytes(32).toString("hex");
    await Invitation.create({
      tenant_id: org._id,
      email,
      role_id: roles[SYSTEM_ROLE.STAFF]._id,
      status: INVITE_STATUS.PENDING,
      token_hash: inviteService.hashToken(token),
      expires_at: new Date(Date.now() + 60_000),
      sent_at: new Date(),
    });

    assert.equal((await inviteService.getInvitePreview(token)).needs_password, false);
    const { user } = await inviteService.registerFromInvite(token, { first_name: "Old", last_name: "Link", password: "password123" });
    assert.equal(user.email, email);
    assert.equal((await membershipService.listUserMemberships(user._id)).length, 1);
  } finally {
    await cleanup({ tenants: [org], emails: [email] });
  }
});
