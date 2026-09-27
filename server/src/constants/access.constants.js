// constants/access.constants.js

// Protected per-tenant roles; Admin is the owner (superadmin is User.role).
const SYSTEM_ROLE = Object.freeze({
  ADMIN: "Admin",
  STAFF: "Staff",
});

// Pre-rename owner role; treated as Admin until migrateTenantAdminRoles runs.
const LEGACY_OWNER_ROLE = "Super Admin";
const TENANT_ADMIN_ROLE_NAMES = Object.freeze([SYSTEM_ROLE.ADMIN, LEGACY_OWNER_ROLE]);

// Role lives on the membership, so one person can hold a role per tenant.
const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

const INVITE_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  REVOKED: "revoked",
});

module.exports = { SYSTEM_ROLE, LEGACY_OWNER_ROLE, TENANT_ADMIN_ROLE_NAMES, MEMBERSHIP_STATUS, INVITE_STATUS };
