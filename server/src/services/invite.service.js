// services/invite.service.js
// One email, one organisation, one link: a tenant holds at most one invite per address, and
// inviting again reopens the same row with a fresh link, killing the old one.
// The link is bound to its address; another account cannot redeem it.

const crypto = require("node:crypto");
const Invitation = require("../models/Invitation");
const Membership = require("../models/Membership");
const User = require("../models/User");
const Role = require("../models/Role");
const membershipService = require("./membership.service");
const { INVITE_STATUS, INVITE_EXPIRY_DAYS } = require("../constants/access.constants");

const TOKEN_BYTES = 32; // 64 hex characters, matching flowpos-backend's link length

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Only the hash is stored; the plaintext exists just long enough to be sent. */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Put a row back to pending with a brand-new link. Returns the plaintext token. */
function reopen(invite) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");

  invite.status = INVITE_STATUS.PENDING;
  invite.token_hash = hashToken(token);
  invite.expires_at = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
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

/** `is_expired` is a schema virtual that Mongoose doesn't evaluate on .lean() results; computed explicitly instead. */
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

/** Is a role still promised to anyone through a redeemable invite? Used by role.service.js#deleteRole. */
async function hasOpenInviteForRole(tenantId, roleId) {
  const openInvites = await Invitation.find({ tenant_id: tenantId, role_id: roleId, status: INVITE_STATUS.PENDING })
    .select("status expires_at +token_hash")
    .lean();

  return openInvites.some(isOpen);
}

/** Invites an address; an existing row for that address is reopened rather than duplicated. Returns { invitation, token }. */
async function sendInvite({ tenantId, email, roleId, invitedBy = null }) {
  const address = normaliseEmail(email);
  if (!address) throw httpError("An email address is required.", 422);

  const role = await Role.findOne({ _id: roleId, tenant_id: tenantId }).lean();
  if (!role) throw httpError("That role doesn't belong to this organisation.", 422);

  // Someone who is already in is not someone to invite.
  const existingUser = await User.findOne({ email: address }).select("_id").lean();
  if (existingUser) {
    const alreadyMember = await Membership.exists({ tenant_id: tenantId, user_id: existingUser._id });
    if (alreadyMember) throw httpError("That person is already a member of this organisation.", 422);
  }

  const invite =
    (await Invitation.findOne({ tenant_id: tenantId, email: address }).select("+token_hash")) ||
    new Invitation({ tenant_id: tenantId, email: address });

  invite.role_id = roleId;
  invite.invited_by = invitedBy ?? invite.invited_by;
  const token = reopen(invite);
  await invite.save();

  return { invitation: await getInvitationById(invite._id, tenantId), token };
}

/** Same row, new link; the previous link stops working. Refused once accepted. */
async function resendInvite({ invitationId, tenantId, invitedBy = null }) {
  const invite = await Invitation.findOne({ _id: invitationId, tenant_id: tenantId }).select("+token_hash");
  if (!invite) return null;
  if (invite.status === INVITE_STATUS.ACCEPTED) {
    throw httpError("That invitation has already been accepted.", 409);
  }

  invite.invited_by = invitedBy ?? invite.invited_by;
  const token = reopen(invite);
  await invite.save();

  return { invitation: await getInvitationById(invite._id, tenantId), token };
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

  return getInvitationById(invite._id, tenantId);
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

/** What the public landing page shows pre-sign-in; `has_account` lets it go straight to sign-in/sign-up. */
async function getInvitePreview(token) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) return null;

  const populated = await Invitation.findById(invite._id)
    .populate("tenant_id", "name company_name logo_url")
    .populate("role_id", "name")
    .populate("invited_by", "first_name last_name")
    .lean();

  const existingUser = await User.findOne({ email: populated.email }).select("_id").lean();

  return {
    email: populated.email,
    status: populated.status,
    expires_at: populated.expires_at,
    organisation: populated.tenant_id,
    role: populated.role_id,
    invited_by: populated.invited_by
      ? { name: `${populated.invited_by.first_name} ${populated.invited_by.last_name}`.trim() }
      : null,
    has_account: Boolean(existingUser),
  };
}

/** Joins the signed-in user; accepting when already a member settles quietly rather than erroring. */
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

/** Signs up from a link, landing straight in the inviting organisation (no own org created). */
async function registerFromInvite(token, { first_name, last_name, password, phone = null }) {
  const invite = await findOpenInviteByToken(token);
  if (!invite) throw httpError("That invitation link is no longer valid.", 404);

  const existing = await User.findOne({ email: invite.email }).select("_id").lean();
  if (existing) throw httpError("An account already exists for this email. Sign in to accept the invitation.", 409);

  // Required lazily to avoid a load-time cycle: tenant.service -> role.service -> this module.
  const { createUser } = require("./user.service");
  const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");

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

module.exports = {
  normaliseEmail,
  hashToken,
  sendInvite,
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
