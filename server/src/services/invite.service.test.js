// services/invite.service.test.js
// Invites redeem once, bind to the invited email, reuse the row. Needs Mongo.

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
const { SYSTEM_ROLE, INVITE_STATUS } = require("../constants/access.constants");

async function makeTenant(suffix, label = "inv") {
  return Tenant.create({
    name: `Invite ${label} ${suffix}`,
    slug: `invite-${label}-${suffix}`.toLowerCase(),
    code: `IV${label[0].toUpperCase()}${suffix.slice(0, 5).toUpperCase()}`,
    company_name: `Invite ${label} ${suffix}`,
  }).then(trackFixtureTenant);
}

async function makeUser(email, tenantId) {
  return User.create({
    tenant_id: tenantId,
    first_name: "Invite",
    last_name: "Tester",
    email,
    password: "password123",
    role: "user",
    status: "active",
  });
}

async function cleanup({ tenants = [], users = [] }) {
  const tenantIds = tenants.map((t) => t._id);
  const userIds = users.map((u) => u._id);
  await Invitation.deleteMany({ tenant_id: { $in: tenantIds } });
  await Membership.deleteMany({ tenant_id: { $in: tenantIds } });
  await Role.deleteMany({ tenant_id: { $in: tenantIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await Tenant.deleteMany({ _id: { $in: tenantIds } });
  await mongoose.disconnect();
}

test("invite: an existing account accepts, and joins with the role it was invited as", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix);
  const inviter = await makeUser(`inviter-${suffix}@example.test`, org._id);
  const invitee = await makeUser(`invitee-${suffix}@example.test`, org._id);

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    const { invitation, token } = await inviteService.sendInvite({
      tenantId: org._id,
      email: `INVITEE-${suffix}@Example.test`, // deliberately mixed case
      roleId: roles[SYSTEM_ROLE.STAFF]._id,
      invitedBy: inviter._id,
    });

    assert.equal(invitation.email, `invitee-${suffix}@example.test`, "address is normalised");
    assert.equal(invitation.status, INVITE_STATUS.PENDING);
    assert.equal(invitation.is_expired, false, "is_expired is reported, not left undefined");
    assert.ok(token && token.length >= 32, "a link token is returned exactly once");

    // Only the hash is persisted.
    const stored = await Invitation.findById(invitation._id).select("+token_hash").lean();
    assert.notEqual(stored.token_hash, token, "the plaintext token is never stored");
    assert.equal(stored.token_hash, inviteService.hashToken(token));

    // Bound to the invited address.
    await assert.rejects(() => inviteService.acceptInvite(token, inviter), /different email address/);

    await inviteService.acceptInvite(token, invitee);
    assert.equal(
      await membershipService.hasPermission(invitee._id, org._id, "orders.create"),
      true,
      "joined with the invited role",
    );
    assert.equal(await membershipService.hasPermission(invitee._id, org._id, "settings.update"), false);

    // The link is burnt.
    assert.equal(await inviteService.findOpenInviteByToken(token), null, "redeems at most once");
    await assert.rejects(() => inviteService.acceptInvite(token, invitee), /no longer valid/);
    assert.equal((await inviteService.getInvitationById(invitation._id, org._id)).status, INVITE_STATUS.ACCEPTED);

    // Already a member — nothing left to invite them to.
    await assert.rejects(
      () => inviteService.sendInvite({ tenantId: org._id, email: invitee.email, roleId: roles[SYSTEM_ROLE.ADMIN]._id }),
      /already a member/,
    );
  } finally {
    await cleanup({ tenants: [org], users: [inviter, invitee] });
  }
});

test("invite: re-inviting reuses the row, and each resend kills the previous link", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix, "reuse");

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    const email = `reuse-${suffix}@example.test`;

    const first = await inviteService.sendInvite({ tenantId: org._id, email, roleId: roles[SYSTEM_ROLE.STAFF]._id });
    const second = await inviteService.sendInvite({ tenantId: org._id, email, roleId: roles[SYSTEM_ROLE.ADMIN]._id });

    assert.equal(await Invitation.countDocuments({ tenant_id: org._id, email }), 1, "one row per address");
    assert.equal(String(second.invitation._id), String(first.invitation._id), "the same row, reopened");
    assert.equal(second.invitation.role_id.name, SYSTEM_ROLE.ADMIN, "with the new role");
    assert.equal(await inviteService.findOpenInviteByToken(first.token), null, "the first link is dead");
    assert.ok(await inviteService.findOpenInviteByToken(second.token), "the newest link works");

    // Revoking burns it; resending revives the same row.
    await inviteService.revokeInvite({ invitationId: first.invitation._id, tenantId: org._id });
    assert.equal(await inviteService.findOpenInviteByToken(second.token), null, "revoked link is dead");
    await assert.rejects(
      () => inviteService.revokeInvite({ invitationId: first.invitation._id, tenantId: org._id }),
      /pending/,
      "only a pending invite can be revoked",
    );

    const third = await inviteService.resendInvite({ invitationId: first.invitation._id, tenantId: org._id });
    assert.equal(third.invitation.status, INVITE_STATUS.PENDING, "resend revives it");
    assert.ok(await inviteService.findOpenInviteByToken(third.token));
    assert.equal(await Invitation.countDocuments({ tenant_id: org._id, email }), 1, "still one row");
  } finally {
    await cleanup({ tenants: [org], users: [] });
  }
});

test("invite: an expired link is dead but revivable, and signing up from a link joins that org only", async () => {
  await mongoose.connect(config.mongoUri);
  const suffix = crypto.randomUUID().slice(0, 8);
  const org = await makeTenant(suffix, "signup");
  let created = null;

  try {
    const roles = await roleService.seedSystemRoles(org._id);
    const email = `newcomer-${suffix}@example.test`;

    const { invitation, token } = await inviteService.sendInvite({
      tenantId: org._id,
      email,
      roleId: roles[SYSTEM_ROLE.STAFF]._id,
    });

    // Expiry isn't a status: the row stays pending, the link stops working.
    await Invitation.updateOne({ _id: invitation._id }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    assert.equal(await inviteService.findOpenInviteByToken(token), null, "expired link is dead");
    const expired = await inviteService.getInvitationById(invitation._id, org._id);
    assert.equal(expired.status, INVITE_STATUS.PENDING, "still pending");
    assert.equal(expired.is_expired, true, "and reports itself expired");

    const revived = await inviteService.resendInvite({ invitationId: invitation._id, tenantId: org._id });
    assert.equal(revived.invitation.is_expired, false);

    const result = await inviteService.registerFromInvite(revived.token, {
      first_name: "New",
      last_name: "Comer",
      password: "password123",
    });
    created = result.user;

    assert.equal(created.email, email, "the account is created for the invited address only");
    const memberships = await membershipService.listUserMemberships(created._id);
    assert.equal(memberships.length, 1, "lands in the inviting organisation and no other");
    assert.equal(String(memberships[0].tenant_id._id), String(org._id));
    assert.equal(await inviteService.findOpenInviteByToken(revived.token), null, "the link is consumed");

    // A second signup on a burnt link can't work.
    await assert.rejects(
      () => inviteService.registerFromInvite(revived.token, { first_name: "A", last_name: "B", password: "password123" }),
      /no longer valid/,
    );
  } finally {
    await cleanup({ tenants: [org], users: created ? [created] : [] });
  }
});
