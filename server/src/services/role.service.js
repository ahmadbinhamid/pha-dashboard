// services/role.service.js
// Owns every Role query. Roles are per-tenant; every tenant is seeded with three protected
// SYSTEM_ROLEs that can't be renamed/re-permissioned/deleted, so a tenant can't lock itself out.

const { Types } = require("mongoose");
const Role = require("../models/Role");
const Membership = require("../models/Membership");
const inviteService = require("./invite.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");
const { ALL_PERMISSIONS, unknownPermissions, groupPermissions } = require("../config/permissions");

// Aggregations don't get Mongoose's automatic casting, so an id has to be a
// real ObjectId before it reaches $match.
function toObjectId(id) {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

// What each seeded role can do. Super Admin lists everything for display; checks short-circuit on it anyway.
const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: SYSTEM_ROLE.SUPER_ADMIN,
    description: "Full access, including roles and billing. Cannot be edited or removed.",
    permissions: () => ALL_PERMISSIONS,
  },
  {
    name: SYSTEM_ROLE.ADMIN,
    description: "Runs the store day to day and manages the team, but can't redefine what roles may do.",
    // Everything except restructuring permissions themselves, so an Admin can't widen their own access.
    permissions: () => ALL_PERMISSIONS.filter((p) => !["roles.create", "roles.update", "roles.delete"].includes(p)),
  },
  {
    name: SYSTEM_ROLE.STAFF,
    description: "Sells, picks and counts stock. No settings, integrations or team access.",
    permissions: () => [
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
    ],
  },
];

function assertPermissionsAreKnown(permissions = []) {
  const unknown = unknownPermissions(permissions);
  if (unknown.length > 0) {
    const err = new Error(`Unknown permission(s): ${unknown.join(", ")}`);
    err.status = 422;
    throw err;
  }
}

/** Gives a tenant its system roles; idempotent, and repairs a tenant missing one. */
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
  if (role.is_system) {
    const err = new Error("System roles cannot be edited.");
    err.status = 403;
    throw err;
  }

  if (permissions !== undefined) {
    assertPermissionsAreKnown(permissions);
    role.permissions = permissions;
  }
  if (name !== undefined) role.name = name;
  if (description !== undefined) role.description = description;

  await role.save();
  return role.toObject();
}

/** Refused for system roles, roles still held by a member, or roles a pending invite promises. */
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

module.exports = {
  SYSTEM_ROLE_DEFINITIONS,
  seedSystemRoles,
  listRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
};
