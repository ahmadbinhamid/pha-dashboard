// services/membership.service.js
// Owns every Membership query, the join letting one person belong to several organisations.
// Permissions only ever come from an ACTIVE membership; removing someone deletes only that membership.

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

/** Every organisation a user belongs to — what the org switcher renders and auth picks the active tenant from. */
async function listUserMemberships(userId) {
  return Membership.find({ user_id: userId, status: MEMBERSHIP_STATUS.ACTIVE })
    .populate("tenant_id", "name company_name slug logo_url status")
    // `permissions` comes along since auth.js resolves the active org from this same call per request.
    .populate("role_id", "name is_system permissions")
    .sort({ is_default: -1, joined_at: 1 })
    .lean();
}

/** Attaches a user to an organisation; joining twice is a no-op. Their first org becomes the default. */
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

/** Changes someone's role or suspends/restores them; refuses to touch a Super Admin. */
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

/** Removes someone from one organisation only; if it was their default, the oldest remaining membership takes over. */
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

/** The permissions a user holds; [] when not a member or suspended. Super Admin gets the whole catalogue. */
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

/** Pure check against an already-loaded membership, so callers with one already don't need a second query. */
function membershipHasPermission(membership, permission) {
  if (!membership) return false;
  // Short-circuit, so Super Admin keeps working as the catalogue grows.
  if (membership.role_id?.name === SYSTEM_ROLE.SUPER_ADMIN) return true;
  return (membership.role_id?.permissions ?? []).includes(permission);
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

  return membershipHasPermission(membership, permission);
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
  membershipHasPermission,
  touchLastActive,
  countMembersByRole,
};
