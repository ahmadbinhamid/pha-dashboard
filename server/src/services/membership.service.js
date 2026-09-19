// services/membership.service.js
//
// Owns every Membership query — the join that lets one person belong to
// several organisations, holding a different role in each.
//
// Two rules the rest of the app leans on:
//   * Permissions only ever come from an ACTIVE membership. Suspending
//     someone removes their access without deleting who-did-what.
//   * Removing someone from an organisation deletes the membership only. The
//     account, and their membership of other organisations, survive.
//
// Mirrors flowpos-backend's tenant_user pivot (role_id / is_active /
// is_default / added_at) and its User::hasPermission semantics.

const { Types } = require("mongoose");
const Membership = require("../models/Membership");
const Role = require("../models/Role");
const { MEMBERSHIP_STATUS, SYSTEM_ROLE } = require("../constants/access.constants");

function toObjectId(id) {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

/** The members of one organisation, with their user and role resolved. */
async function listMembers(tenantId) {
  return Membership.find({ tenant_id: tenantId })
    .populate("user_id", "first_name last_name email phone profile_image status verified_at last_login_at")
    .populate("role_id", "name description is_system permissions")
    .populate("invited_by", "first_name last_name email")
    .sort({ joined_at: 1 })
    .lean();
}

/** One person's membership of one organisation, with its role resolved. */
async function getMembership(userId, tenantId) {
  return Membership.findOne({ user_id: userId, tenant_id: tenantId })
    .populate("role_id", "name description is_system permissions")
    .lean();
}

/**
 * Every organisation a user belongs to — what an org switcher renders, and
 * what the auth layer picks the active tenant from.
 */
async function listUserMemberships(userId) {
  return Membership.find({ user_id: userId, status: MEMBERSHIP_STATUS.ACTIVE })
    .populate("tenant_id", "name company_name slug logo_url status")
    // `permissions` comes along because the auth layer resolves the active
    // organisation from this same call on every request (see
    // middlewares/auth.js) — leaving it out cost a second query per request,
    // or silently handed the request an empty permission set.
    .populate("role_id", "name is_system permissions")
    .sort({ is_default: -1, joined_at: 1 })
    .lean();
}

/**
 * Attach a user to an organisation. Joining twice is a no-op rather than an
 * error — an invite accepted by an existing member should settle quietly.
 * Their first organisation becomes the one the dashboard opens on.
 */
async function addMember({ tenantId, userId, roleId, invitedBy = null }) {
  const existing = await Membership.findOne({ tenant_id: tenantId, user_id: userId });
  if (existing) return existing.toObject();

  const hasDefault = await Membership.exists({ user_id: userId, is_default: true });

  const membership = await Membership.create({
    tenant_id: tenantId,
    user_id: userId,
    role_id: roleId,
    invited_by: invitedBy,
    is_default: !hasDefault,
    joined_at: new Date(),
  });

  return membership.toObject();
}

/**
 * Change someone's role or suspend/restore them, within one organisation.
 * Refuses to touch a Super Admin, matching flowpos-backend — otherwise an
 * Admin could demote the only person who can undo it.
 */
async function updateMember(userId, tenantId, { roleId, status }) {
  const membership = await Membership.findOne({ user_id: userId, tenant_id: tenantId }).populate("role_id", "name");
  if (!membership) return null;

  if (membership.role_id?.name === SYSTEM_ROLE.SUPER_ADMIN) {
    const err = new Error("A Super Admin's access can't be changed.");
    err.status = 403;
    throw err;
  }

  if (roleId !== undefined) {
    const role = await Role.findOne({ _id: roleId, tenant_id: tenantId }).lean();
    if (!role) {
      const err = new Error("That role doesn't belong to this organisation.");
      err.status = 422;
      throw err;
    }
    membership.role_id = roleId;
  }
  if (status !== undefined) membership.status = status;

  await membership.save();
  return getMembership(userId, tenantId);
}

/**
 * Remove someone from ONE organisation. Their account and any other
 * memberships are untouched. If this was their default, the oldest remaining
 * membership takes over so they still land somewhere on next sign-in.
 */
async function removeMember(userId, tenantId) {
  const membership = await Membership.findOne({ user_id: userId, tenant_id: tenantId }).populate("role_id", "name");
  if (!membership) return null;

  if (membership.role_id?.name === SYSTEM_ROLE.SUPER_ADMIN) {
    const err = new Error("A Super Admin can't be removed from the organisation.");
    err.status = 403;
    throw err;
  }

  const wasDefault = membership.is_default;
  await membership.deleteOne();

  if (wasDefault) {
    const next = await Membership.findOne({ user_id: userId }).sort({ joined_at: 1 });
    if (next) {
      next.is_default = true;
      await next.save();
    }
  }

  return membership.toObject();
}

/** Point a user's default organisation at one they actually belong to. */
async function setDefaultMembership(userId, tenantId) {
  const target = await Membership.findOne({ user_id: userId, tenant_id: tenantId });
  if (!target) return null;

  await Membership.updateMany({ user_id: userId, is_default: true }, { $set: { is_default: false } });
  target.is_default = true;
  await target.save();
  return target.toObject();
}

/**
 * The permissions a user holds in an organisation — [] when they aren't a
 * member, or are suspended. Super Admin returns the whole catalogue via its
 * seeded permission list.
 */
async function getPermissions(userId, tenantId) {
  const membership = await Membership.findOne({
    user_id: userId,
    tenant_id: tenantId,
    status: MEMBERSHIP_STATUS.ACTIVE,
  })
    .populate("role_id", "name permissions")
    .lean();

  return membership?.role_id?.permissions ?? [];
}

/** Does this user hold `permission` in this organisation right now? */
async function hasPermission(userId, tenantId, permission) {
  const membership = await Membership.findOne({
    user_id: userId,
    tenant_id: tenantId,
    status: MEMBERSHIP_STATUS.ACTIVE,
  })
    .populate("role_id", "name permissions")
    .lean();

  if (!membership) return false;
  // Short-circuit, so Super Admin keeps working as the catalogue grows.
  if (membership.role_id?.name === SYSTEM_ROLE.SUPER_ADMIN) return true;
  return (membership.role_id?.permissions ?? []).includes(permission);
}

/** Stamped by the auth layer, so "last active" on the members table is real. */
async function touchLastActive(userId, tenantId) {
  await Membership.updateOne(
    { user_id: userId, tenant_id: tenantId },
    { $set: { last_active_at: new Date() } },
  );
}

/** How many people hold each role in a tenant — used by the roles table. */
async function countMembersByRole(tenantId) {
  const rows = await Membership.aggregate([
    { $match: { tenant_id: toObjectId(tenantId), deleted_at: null } },
    { $group: { _id: "$role_id", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

module.exports = {
  listMembers,
  getMembership,
  listUserMemberships,
  addMember,
  updateMember,
  removeMember,
  setDefaultMembership,
  getPermissions,
  hasPermission,
  touchLastActive,
  countMembersByRole,
};
