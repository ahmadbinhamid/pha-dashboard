// constants/access.constants.js

// Protected per-tenant roles; Admin is the owner (superadmin is User.role).
const SYSTEM_ROLE = Object.freeze({
  ADMIN: "Admin",
  STAFF: "Staff",
});

// Pre-rename owner role; treated as Admin until migrateTenantAdminRoles runs.
const LEGACY_OWNER_ROLE = "Super Admin";
const TENANT_ADMIN_ROLE_NAMES = Object.freeze([SYSTEM_ROLE.ADMIN, LEGACY_OWNER_ROLE]);

// Account roles that owned a tenant before memberships existed.
const OWNER_ACCOUNT_ROLES = Object.freeze(["admin", "superadmin"]);

// Role lives on the membership, so one person can hold a role per tenant.
const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

// "Last active" is stamped at most this often, so auth rarely writes.
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

const INVITE_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  REVOKED: "revoked",
});

module.exports = {
  SYSTEM_ROLE,
  LEGACY_OWNER_ROLE,
  TENANT_ADMIN_ROLE_NAMES,
  OWNER_ACCOUNT_ROLES,
  MEMBERSHIP_STATUS,
  LAST_ACTIVE_THROTTLE_MS,
  INVITE_STATUS,
};
