// constants/access.constants.js

// The roles every tenant is seeded with. They can't be renamed, re-permissioned
// or deleted — a tenant always has a way back in, and "Super Admin" stays the
// thing permission checks can short-circuit on. Tenants add their own roles on
// top of these (see role.service.js#createRole).
//
// Mirrors flowpos-backend's Role::SUPER_ADMIN convention, where the super-admin
// role is likewise special-cased rather than permission-checked.
const SYSTEM_ROLE = Object.freeze({
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
});

// A membership is how a user belongs to ONE organisation. The same person can
// hold several, each with its own role — which is why role lives here and not
// on the User.
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

// How long an invite link stays redeemable. Matches flowpos-backend's
// USER_INVITE_EXPIRY_DAYS default.
const INVITE_EXPIRY_DAYS = Number(process.env.USER_INVITE_EXPIRY_DAYS || 7);

module.exports = { SYSTEM_ROLE, MEMBERSHIP_STATUS, INVITE_STATUS, INVITE_EXPIRY_DAYS };
