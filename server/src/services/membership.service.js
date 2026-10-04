// services/membership.service.js
// Owns Membership queries; only an ACTIVE membership grants permissions.

const { Types } = require("mongoose");
const Membership = require("../models/Membership");
const Role = require("../models/Role");
const {
  MEMBERSHIP_STATUS,
  TENANT_ADMIN_ROLE_NAMES,
  LAST_ACTIVE_THROTTLE_MS,
  OWNER_ACCOUNT_ROLES,
} = require("../constants/access.constants");
const { ALL_PERMISSIONS } = require("../config/permissions");

// Admin, or the pre-migration Super Admin name for the same owner role.
function isAdminRole(role) {
  return TENANT_ADMIN_ROLE_NAMES.includes(role?.name);
}

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

/** A user's active orgs; feeds the org switcher and auth's tenant pick. */
function activeMembershipsQuery(userId) {
  return Membership.find({ user_id: userId, status: MEMBERSHIP_STATUS.ACTIVE })
    .populate("role_id", "name is_system permissions")
    .sort({ is_default: -1, joined_at: 1 })
    .lean();
}

async function listUserMemberships(userId) {
  return activeMembershipsQuery(userId).populate("tenant_id", "name company_name slug logo_url status");
}

/** Per-request lookup; skips the tenant populate auth loads itself. */
async function listMembershipsForAuth(userId) {
  return activeMembershipsQuery(userId);
}

/** Idempotent; a user's first organisation becomes their default. */
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

/** Changes someone's role or suspends/restores them; refuses an Admin. */
async function updateMember(userId, tenantId, { roleId, status }) {
  const membership = await Membership.findOne({ user_id: userId, tenant_id: tenantId }).populate("role_id", "name");
  if (!membership) return null;

  if (isAdminRole(membership.role_id)) {
    const err = new Error("An Admin's access can't be changed.");
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
    if (isAdminRole(role)) {
      const err = new Error("The Admin role can't be given to someone else.");
      err.status = 422;
      throw err;
    }
    membership.role_id = roleId;
  }
  if (status !== undefined) membership.status = status;

  await membership.save();
  return getMembership(userId, tenantId);
}

/** Removes one membership; the oldest remaining one becomes the default. */
async function removeMember(userId, tenantId) {
  const membership = await Membership.findOne({ user_id: userId, tenant_id: tenantId }).populate("role_id", "name");
  if (!membership) return null;

  if (isAdminRole(membership.role_id)) {
    const err = new Error("An Admin can't be removed from the organisation.");
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

/** The user's active membership in a tenant, with role name and permissions. */
function findActiveMembership(userId, tenantId) {
  return Membership.findOne({ user_id: userId, tenant_id: tenantId, status: MEMBERSHIP_STATUS.ACTIVE })
    .populate("role_id", "name permissions")
    .lean();
}

/** Permissions a user holds in a tenant; same rules as a live request. */
async function getPermissions(userId, tenantId) {
  return requestPermissions({ membership: await findActiveMembership(userId, tenantId) });
}

/** Does this user hold `permission` in this organisation right now? */
async function hasPermission(userId, tenantId, permission) {
  return (await getPermissions(userId, tenantId)).includes(permission);
}

// NOTE: legacy owner fallback kept, a test pins it; auth() can't reach it.
function isRequestTenantAdmin({ membership, user, tenantId }) {
  if (membership) return isAdminRole(membership.role_id);
  return Boolean(tenantId) && OWNER_ACCOUNT_ROLES.includes(user?.role);
}

/** Permissions in the request's tenant; the Admin holds them all. */
function requestPermissions({ membership, user, tenantId }) {
  if (isRequestTenantAdmin({ membership, user, tenantId })) return ALL_PERMISSIONS;
  return membership?.status === MEMBERSHIP_STATUS.ACTIVE ? membership.role_id?.permissions ?? [] : [];
}

/** Whether the user is an active Admin (owner) of this tenant. */
async function isTenantAdmin(userId, tenantId) {
  return isAdminRole((await findActiveMembership(userId, tenantId))?.role_id);
}

/** Stamps "last active" off the request path, at most once per window. */
function touchLastActive(membership) {
  const last = membership.last_active_at ? new Date(membership.last_active_at).getTime() : 0;
  if (Date.now() - last < LAST_ACTIVE_THROTTLE_MS) return;
  Membership.updateOne({ _id: membership._id }, { $set: { last_active_at: new Date() } }).catch((err) =>
    console.error("touchLastActive failed:", err.message),
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
  listMembershipsForAuth,
  addMember,
  updateMember,
  removeMember,
  setDefaultMembership,
  getPermissions,
  hasPermission,
  isAdminRole,
  isTenantAdmin,
  isRequestTenantAdmin,
  requestPermissions,
  touchLastActive,
  countMembersByRole,
};
