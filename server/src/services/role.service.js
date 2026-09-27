// services/role.service.js
// Owns every Role query; each tenant is seeded with protected Admin and Staff.

const { Types } = require("mongoose");
const Role = require("../models/Role");
const Membership = require("../models/Membership");
const Invitation = require("../models/Invitation");
const inviteService = require("./invite.service");
const { SYSTEM_ROLE, LEGACY_OWNER_ROLE, TENANT_ADMIN_ROLE_NAMES } = require("../constants/access.constants");
const { ALL_PERMISSIONS, unknownPermissions, groupPermissions } = require("../config/permissions");

// Aggregations don't cast, so ids must be ObjectIds before $match.
function toObjectId(id) {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

const ADMIN_DESCRIPTION = "Owner of this organisation, with full access. Cannot be edited or removed.";

// Staff: everything except managing the team; an Admin can narrow it.
const STAFF_DEFAULT_PERMISSIONS = ALL_PERMISSIONS.filter((p) => !p.startsWith("users.") && !p.startsWith("roles."));

// Staff's pre-permissions seed; roles still exactly this were never edited.
const LEGACY_STAFF_PERMISSIONS = [
  "dashboard.view",
  ...groupPermissions("products").filter((p) => p.endsWith(".view")),
  ...groupPermissions("categories").filter((p) => p.endsWith(".view")),
  "inventory.view",
  "inventory.update",
  "orders.view",
  "orders.create",
  "payments.view",
  "payments.create",
  "customers.view",
  "customers.create",
  "listings.view",
  "locations.view",
];

const SYSTEM_ROLE_DEFINITIONS = [
  { name: SYSTEM_ROLE.ADMIN, description: ADMIN_DESCRIPTION, permissions: () => ALL_PERMISSIONS },
  {
    name: SYSTEM_ROLE.STAFF,
    description: "Day-to-day work across the store. The Admin can change what Staff can do.",
    permissions: () => STAFF_DEFAULT_PERMISSIONS,
  },
];

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function assertPermissionsAreKnown(permissions = []) {
  const unknown = unknownPermissions(permissions);
  if (unknown.length > 0) {
    const err = new Error(`Unknown permission(s): ${unknown.join(", ")}`);
    err.status = 422;
    throw err;
  }
}

/** Seeds a tenant's system roles; idempotent and repairs a missing one. */
async function seedSystemRoles(tenantId) {
  const existing = await Role.find({ tenant_id: tenantId, is_system: true }).lean();
  const byName = new Map(existing.map((r) => [r.name, r]));

  const missing = SYSTEM_ROLE_DEFINITIONS.filter((def) => !byName.has(def.name));
  if (missing.length > 0) {
    const created = await Role.insertMany(
      missing.map((def) => ({
        tenant_id: tenantId,
        name: def.name,
        description: def.description,
        permissions: def.permissions(),
        is_system: true,
      })),
    );
    created.forEach((role) => byName.set(role.name, role.toObject()));
  }

  return Object.fromEntries(byName.entries());
}

/** Roles for a tenant, each with how many members currently hold it. */
async function listRoles(tenantId) {
  const roles = await Role.find({ tenant_id: tenantId }).sort({ is_system: -1, name: 1 }).lean();

  // One grouped count rather than a query per role.
  const counts = await Membership.aggregate([
    { $match: { tenant_id: toObjectId(tenantId), deleted_at: null } },
    { $group: { _id: "$role_id", count: { $sum: 1 } } },
  ]);
  const countByRole = new Map(counts.map((c) => [String(c._id), c.count]));

  return roles.map((role) => ({ ...role, members_count: countByRole.get(String(role._id)) || 0 }));
}

async function getRoleById(roleId, tenantId) {
  return Role.findOne({ _id: roleId, tenant_id: tenantId }).lean();
}

async function getRoleByName(tenantId, name) {
  return Role.findOne({ tenant_id: tenantId, name }).lean();
}

async function createRole(tenantId, { name, description = null, permissions = [] }) {
  assertPermissionsAreKnown(permissions);
  const role = await Role.create({ tenant_id: tenantId, name, description, permissions, is_system: false });
  return role.toObject();
}

async function updateRole(roleId, tenantId, { name, description, permissions }) {
  const role = await Role.findOne({ _id: roleId, tenant_id: tenantId });
  if (!role) return null;
  if (TENANT_ADMIN_ROLE_NAMES.includes(role.name)) {
    const err = new Error("The Admin role always has full access and can't be edited.");
    err.status = 403;
    throw err;
  }
  // System roles (Staff) keep their name; only permissions are editable.
  if (role.is_system && name !== undefined && name !== role.name) {
    const err = new Error("A built-in role's name can't be changed; edit its permissions instead.");
    err.status = 403;
    throw err;
  }

  if (permissions !== undefined) {
    assertPermissionsAreKnown(permissions);
    role.permissions = permissions;
  }
  if (name !== undefined) role.name = name;
  if (description !== undefined && !role.is_system) role.description = description;

  await role.save();
  return role.toObject();
}

/** Refused for system roles and roles held by a member or pending invite. */
async function deleteRole(roleId, tenantId) {
  const role = await Role.findOne({ _id: roleId, tenant_id: tenantId });
  if (!role) return null;
  if (role.is_system) {
    const err = new Error("System roles cannot be deleted.");
    err.status = 403;
    throw err;
  }

  const inUse = await Membership.countDocuments({ tenant_id: tenantId, role_id: roleId });
  if (inUse > 0) {
    const err = new Error(`This role is assigned to ${inUse} member${inUse === 1 ? "" : "s"}. Move them to another role first.`);
    err.status = 409;
    throw err;
  }

  if (await inviteService.hasOpenInviteForRole(tenantId, roleId)) {
    const err = new Error("This role is assigned to a pending invitation. Revoke it or reassign it to another role first.");
    err.status = 409;
    throw err;
  }

  await role.deleteOne();
  return role.toObject();
}

// Folds a tenant's old Super Admin + Admin roles into one Admin role.
async function mergeTenantOwnerRoles(tenantId, dryRun) {
  const roles = await Role.find({ tenant_id: tenantId, is_system: true, name: { $in: [LEGACY_OWNER_ROLE, SYSTEM_ROLE.ADMIN] } }).lean();
  const legacy = roles.find((r) => r.name === LEGACY_OWNER_ROLE);
  const oldAdmin = roles.find((r) => r.name === SYSTEM_ROLE.ADMIN);
  if (!legacy) return null;

  const [movedMembers, movedInvites] = await Promise.all([
    oldAdmin ? Membership.countDocuments({ tenant_id: tenantId, role_id: oldAdmin._id }) : 0,
    oldAdmin ? Invitation.countDocuments({ tenant_id: tenantId, role_id: oldAdmin._id }) : 0,
  ]);
  if (!dryRun) {
    if (oldAdmin) {
      await Membership.updateMany({ tenant_id: tenantId, role_id: oldAdmin._id }, { $set: { role_id: legacy._id } });
      await Invitation.updateMany({ tenant_id: tenantId, role_id: oldAdmin._id }, { $set: { role_id: legacy._id } });
      // Hard delete: the unique name index must be free for the rename.
      await Role.collection.deleteOne({ _id: oldAdmin._id });
    }
    await Role.updateOne(
      { _id: legacy._id },
      { $set: { name: SYSTEM_ROLE.ADMIN, description: ADMIN_DESCRIPTION, permissions: ALL_PERMISSIONS } },
    );
  }
  return { tenant_id: String(tenantId), moved_members: movedMembers, moved_invites: movedInvites, removed_old_admin: !!oldAdmin };
}

/** Migrates every tenant still on Super Admin; dry run by default. */
async function migrateTenantAdminRoles({ dryRun = true, tenantId = null } = {}) {
  const filter = { is_system: true, name: LEGACY_OWNER_ROLE, ...(tenantId ? { tenant_id: tenantId } : {}) };
  const tenantIds = await Role.distinct("tenant_id", filter);
  const results = [];
  for (const id of tenantIds) {
    const result = await mergeTenantOwnerRoles(id, dryRun);
    if (result) results.push(result);
  }
  return { dryRun, tenants: results.length, results, staff: await refreshStaffDefaults({ dryRun, tenantId }) };
}

// Untouched Staff roles move to the new default; edited ones are left alone.
async function refreshStaffDefaults({ dryRun, tenantId }) {
  const staffRoles = await Role.find({ is_system: true, name: SYSTEM_ROLE.STAFF, ...(tenantId ? { tenant_id: tenantId } : {}) })
    .select("_id permissions")
    .lean();
  const stale = staffRoles.filter((r) => sameSet(r.permissions, LEGACY_STAFF_PERMISSIONS));
  if (!dryRun && stale.length) {
    await Role.updateMany({ _id: { $in: stale.map((r) => r._id) } }, { $set: { permissions: STAFF_DEFAULT_PERMISSIONS } });
  }
  return { updated: stale.length, customised: staffRoles.length - stale.length };
}

module.exports = {
  SYSTEM_ROLE_DEFINITIONS,
  STAFF_DEFAULT_PERMISSIONS,
  seedSystemRoles,
  migrateTenantAdminRoles,
  listRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
};
