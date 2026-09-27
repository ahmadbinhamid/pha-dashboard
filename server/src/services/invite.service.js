// services/invite.service.js
// New emails get a set-password link; existing accounts are added directly.

const crypto = require("node:crypto");
const config = require("../config");
const Invitation = require("../models/Invitation");
const Membership = require("../models/Membership");
const User = require("../models/User");
const Role = require("../models/Role");
const membershipService = require("./membership.service");
const { INVITE_STATUS, SYSTEM_ROLE } = require("../constants/access.constants");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");

const TOKEN_BYTES = 32; // 64 hex characters, matching flowpos-backend's link length

function httpError(message, status, props = {}) {
  return Object.assign(new Error(message), { status, ...props });
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Only the hash is stored; the plaintext token is only ever emailed. */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Resets a row to pending with a fresh link; returns the plaintext token. */
function reopen(invite) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");

  invite.status = INVITE_STATUS.PENDING;
  invite.token_hash = hashToken(token);
  invite.expires_at = new Date(Date.now() + config.invites.expiryHours * 60 * 60 * 1000);
  invite.sent_at = new Date();
  invite.accepted_at = null;
  invite.declined_at = null;
  invite.revoked_at = null;

  return token;
}

/** Leave pending and burn the link so it can't be redeemed again. */
function close(invite, status, stampField) {
  invite.status = status;
  invite.token_hash = null;
  invite[stampField] = new Date();
}

/** Computes is_expired, since schema virtuals don't run on .lean() results. */
function decorate(invite) {
  if (!invite) return invite;
  return {
    ...invite,
    is_expired: Boolean(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()),
  };
}

function isOpen(invite) {
  return (
    invite &&
    invite.status === INVITE_STATUS.PENDING &&
    Boolean(invite.token_hash) &&
    (!invite.expires_at || invite.expires_at.getTime() > Date.now())
  );
}

/** Whether a redeemable invite still promises this role (blocks deletion). */
async function hasOpenInviteForRole(tenantId, roleId) {
  const openInvites = await Invitation.find({ tenant_id: tenantId, role_id: roleId, status: INVITE_STATUS.PENDING })
    .select("status expires_at +token_hash")
    .lean();

  return openInvites.some(isOpen);
}

// The tenant's Staff role; seeded on the fly for a tenant that predates it.
async function staffRole(tenantId) {
  const role = await Role.findOne({ tenant_id: tenantId, name: SYSTEM_ROLE.STAFF, is_system: true }).lean();
  if (role) return role;
  // Lazy: role.service requires this module.
  const roles = await require("./role.service").seedSystemRoles(tenantId);
  return roles[SYSTEM_ROLE.STAFF];
}

// A tenant role an invite may grant; the Admin (owner) role never is.
async function assignableRole(tenantId, roleId) {
  const role = await Role.findOne({ _id: roleId, tenant_id: tenantId }).lean();
  if (!role) throw httpError("That role doesn't belong to this organisation.", 422);
  if (membershipService.isAdminRole(role)) throw httpError("The Admin role can't be given to someone else.", 422);
  return role;
}

// Account for an email: an activated one if any, else a still-pending one.
async function findAccountByEmail(email) {
  const accounts = await User.find({ email }).select("_id status first_name last_name").lean();
  return accounts.find((a) => a.status !== USER_STATUS.INVITED) ?? accounts[0] ?? null;
}

/** Seconds left on the resend cooldown; 0 once it has passed. */
function resendWaitSeconds(invite) {
  if (!invite.sent_at) return 0;
  const elapsed = (Date.now() - new Date(invite.sent_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(config.invites.resendCooldownSeconds - elapsed));
}

/** Adds Staff: existing accounts join directly, new ones get a pending one. */
async function inviteUser({ tenantId, firstName, lastName, email, roleId = null, invitedBy = null }) {
  const address = normaliseEmail(email);
  if (!address) throw httpError("An email address is required.", 422);
  const role = roleId ? await assignableRole(tenantId, roleId) : await staffRole(tenantId);
  const account = await findAccountByEmail(address);

  if (account && (await Membership.exists({ tenant_id: tenantId, user_id: account._id }))) {
    const pending = account.status === USER_STATUS.INVITED;
    throw httpError(pending ? "They're already invited; resend the invite instead." : "That person is already a member of this organisation.", 422);
  }

  // NOTE: never a password link for a live account; that would allow takeover.
  if (account && account.status !== USER_STATUS.INVITED) {
    await membershipService.addMember({ tenantId, userId: account._id, roleId: role._id, invitedBy });
    return { mode: "added", user: account };
  }

  const user =
    account ??
    (await User.create({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email: address,
      // Unusable until the invitee sets their own via the link.
      password: crypto.randomBytes(32).toString("hex"),
      role: USER_ROLE.USER,
      status: USER_STATUS.INVITED,
    }));
  await membershipService.addMember({ tenantId, userId: user._id, roleId: role._id, invitedBy });

  const invite =
    (await Invitation.findOne({ tenant_id: tenantId, email: address }).select("+token_hash")) ||
    new Invitation({ tenant_id: tenantId, email: address });
  invite.role_id = role._id;
  invite.invited_by = invitedBy ?? invite.invited_by;
  const token = reopen(invite);
  await invite.save();

  return { mode: "invited", user, invitation: await getInvitationById(invite._id, tenantId), token };
}

/** Same row, new link; the old link dies. Refused once accepted. */
async function resendInvite({ invitationId, tenantId, invitedBy = null }) {
  const invite = await Invitation.findOne({ _id: invitationId, tenant_id: tenantId }).select("+token_hash");
  if (!invite) return null;
  if (invite.status === INVITE_STATUS.ACCEPTED) {
    throw httpError("That invitation has already been accepted.", 409);
  }
  const wait = resendWaitSeconds(invite);
  if (wait > 0) throw httpError(`You can resend this invite in ${wait}s.`, 429, { retry_after: wait });

  invite.invited_by = invitedBy ?? invite.invited_by;
  const token = reopen(invite);
  await invite.save();

  // Pre-flow invites have no pending account; they keep the old join link.
  const pendingUser = await User.findOne({ email: invite.email, status: USER_STATUS.INVITED }).select("first_name").lean();
  return { invitation: await getInvitationById(invite._id, tenantId), token, pendingUser };
}

/** Burns the link. Only a pending invite can be revoked. */
async function revokeInvite({ invitationId, tenantId }) {
  const invite = await Invitation.findOne({ _id: invitationId, tenant_id: tenantId }).select("+token_hash");
  if (!invite) return null;
  if (invite.status !== INVITE_STATUS.PENDING) {
    throw httpError("Only a pending invitation can be revoked.", 409);
  }

  close(invite, INVITE_STATUS.REVOKED, "revoked_at");
  await invite.save();
  await removePendingAccount(tenantId, invite.email);

  return getInvitationById(invite._id, tenantId);
}

// A never-activated account leaves this tenant; deleted if it has no other.
async function removePendingAccount(tenantId, email) {
  const user = await User.findOne({ email, status: USER_STATUS.INVITED }).select("_id").lean();
  if (!user) return;
  await Membership.deleteOne({ tenant_id: tenantId, user_id: user._id });
  if (!(await Membership.exists({ user_id: user._id }))) await User.deleteOne({ _id: user._id });
}

async function listInvitations(tenantId, { status } = {}) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;

  const invitations = await Invitation.find(filter)
    .populate("role_id", "name is_system")
    .populate("invited_by", "first_name last_name email")
    .sort({ updated_at: -1 })
    .lean();

  return invitations.map(decorate);
}

async function getInvitationById(invitationId, tenantId) {
  const invitation = await Invitation.findOne({ _id: invitationId, tenant_id: tenantId })
    .populate("role_id", "name is_system")
    .populate("invited_by", "first_name last_name email")
    .lean();

  return decorate(invitation);
}

/** The invite a link points at, or null if it is unknown, used or expired. */
async function findOpenInviteByToken(token) {
  if (!token) return null;
  const invite = await Invitation.findOne({ token_hash: hashToken(token) }).select("+token_hash");
  return isOpen(invite) ? invite : null;
}

/** Public pre-sign-in preview; has_account picks sign-in vs sign-up. */
async function getInvitePreview(token) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) return null;

  const populated = await Invitation.findById(invite._id)
    .populate("tenant_id", "name company_name logo_url")
    .populate("role_id", "name")
    .populate("invited_by", "first_name last_name")
    .lean();

  const account = await findAccountByEmail(populated.email);

  return {
    email: populated.email,
    status: populated.status,
    expires_at: populated.expires_at,
    organisation: populated.tenant_id,
    role: populated.role_id,
    invited_by: populated.invited_by
      ? { name: `${populated.invited_by.first_name} ${populated.invited_by.last_name}`.trim() }
      : null,
    has_account: Boolean(account),
    // New-style invite: a pending account waiting for its first password.
    needs_password: account?.status === USER_STATUS.INVITED,
    first_name: account?.first_name ?? null,
  };
}

/** Joins the signed-in user; already being a member is not an error. */
async function acceptInvite(token, user) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) throw httpError("That invitation link is no longer valid.", 404);

  if (normaliseEmail(user.email) !== invite.email) {
    throw httpError("This invitation was sent to a different email address.", 403);
  }

  await membershipService.addMember({
    tenantId: invite.tenant_id,
    userId: user._id,
    roleId: invite.role_id,
    invitedBy: invite.invited_by,
  });

  close(invite, INVITE_STATUS.ACCEPTED, "accepted_at");
  await invite.save();

  return getInvitationById(invite._id, invite.tenant_id);
}

async function declineInvite(token, user) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) throw httpError("That invitation link is no longer valid.", 404);

  if (normaliseEmail(user.email) !== invite.email) {
    throw httpError("This invitation was sent to a different email address.", 403);
  }

  close(invite, INVITE_STATUS.DECLINED, "declined_at");
  await invite.save();

  return getInvitationById(invite._id, invite.tenant_id);
}

/** Signs up into the inviting organisation without creating an own org. */
async function registerFromInvite(token, { first_name, last_name, password, phone = null }) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) throw httpError("That invitation link is no longer valid.", 404);

  const existing = await User.findOne({ email: invite.email }).select("_id").lean();
  if (existing) throw httpError("An account already exists for this email. Sign in to accept the invitation.", 409);

  // Lazy: avoids a load-time cycle via tenant.service -> role.service.
  const { createUser } = require("./user.service");

  const user = await createUser({
    tenant_id: invite.tenant_id,
    first_name,
    last_name,
    email: invite.email,
    password,
    phone,
    role: USER_ROLE.USER,
    status: USER_STATUS.ACTIVE,
    // Reaching the link proves the address, same as a verification email would.
    verified_at: new Date(),
  });

  await membershipService.addMember({
    tenantId: invite.tenant_id,
    userId: user._id,
    roleId: invite.role_id,
    invitedBy: invite.invited_by,
  });

  close(invite, INVITE_STATUS.ACCEPTED, "accepted_at");
  await invite.save();

  return { user, invitation: await getInvitationById(invite._id, invite.tenant_id) };
}

/** Sets the invitee's first password; returns their email to log in with. */
async function activateInvite(token, password) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) throw httpError("That link has expired or was already used. Ask your admin to resend it.", 404);

  const user = await User.findOne({ email: invite.email, status: USER_STATUS.INVITED });
  if (!user) throw httpError("This account is already set up. Sign in instead.", 409);

  user.password = password;
  user.status = USER_STATUS.ACTIVE;
  user.verified_at = new Date();
  await user.save();

  close(invite, INVITE_STATUS.ACCEPTED, "accepted_at");
  await invite.save();
  return { email: user.email };
}

module.exports = {
  normaliseEmail,
  hashToken,
  inviteUser,
  activateInvite,
  resendWaitSeconds,
  resendInvite,
  revokeInvite,
  listInvitations,
  getInvitationById,
  findOpenInviteByToken,
  hasOpenInviteForRole,
  getInvitePreview,
  acceptInvite,
  declineInvite,
  registerFromInvite,
};
