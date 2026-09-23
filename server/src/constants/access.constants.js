// constants/access.constants.js

// The roles every tenant is seeded with; can't be renamed, re-permissioned or deleted, so a
// tenant always has a way back in and Super Admin stays what permission checks short-circuit on.
const SYSTEM_ROLE = Object.freeze({
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
});

// A membership is how a user belongs to one organisation; role lives here, not on the User,
// since the same person can hold several memberships each with its own role.
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

// How long an invite link stays redeemable.
const INVITE_EXPIRY_DAYS = Number(process.env.USER_INVITE_EXPIRY_DAYS || 7);

module.exports = { SYSTEM_ROLE, MEMBERSHIP_STATUS, INVITE_STATUS, INVITE_EXPIRY_DAYS };
