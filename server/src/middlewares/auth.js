// middlewares/auth.js

const { unauthorized, forbidden } = require("../utils/http/response");
const { verifyJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const membershipService = require("../services/membership.service");
const { MEMBERSHIP_STATUS } = require("../constants/access.constants");

const ROLES = { superadmin: "superadmin", admin: "admin", user: "user" };

function extractToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const t = req.header("auth-token");
  if (t) return t.trim();
  return null;
}

const auth =
  (required = true) =>
  async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token)
        return required ? unauthorized(res, "Missing Bearer token") : next();

      let decoded;
      try {
        decoded = verifyJwt(token); // { sub, role, iat, exp, ... }
      } catch {
        return unauthorized(res, "Invalid or expired token");
      }

      // Parallel: both depend only on decoded.sub.
      const [user, memberships] = await Promise.all([
        User.findById(decoded.sub).select("-password"),
        membershipService.listUserMemberships(decoded.sub),
      ]);
      if (!user) return forbidden(res, "Account not found or disabled");

      req.auth = decoded;
      req.user = user;

      // Per request, not from the JWT, so org switches/joins apply immediately.
      const requestedTenantId = req.header("x-tenant-id");
      const active = requestedTenantId
        ? memberships.find((m) => String(m.tenant_id?._id ?? m.tenant_id) === String(requestedTenantId))
        : memberships.find((m) => m.is_default) || memberships[0];

      if (requestedTenantId && !active) {
        return forbidden(res, "You don't have access to that organisation");
      }

      if (active) {
        req.membership = active;
        req.tenantId = active.tenant_id?._id ?? active.tenant_id;
        // Full doc, not the populated lean copy; SKU/prefix code needs every field.
        req.tenant = await Tenant.findById(req.tenantId);
        req.permissions = active.role_id?.permissions ?? [];
      } else {
        // No membership yet: fall back to User.tenant_id and legacy User.role.
        req.tenantId = user.tenant_id;
        req.permissions = [];
        if (user.tenant_id) req.tenant = await Tenant.findById(user.tenant_id);
      }

      if (req.tenantId && !req.tenant) return forbidden(res, "Tenant not found or disabled");
      if (req.membership && req.membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
        return forbidden(res, "Your access to this organisation has been suspended");
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };

const requireRoles =
  (...allowed) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role) return unauthorized(res, "Unauthorized");
    if (!allowed.includes(role)) return forbidden(res, "Forbidden");
    return next();
  };

/** Queried live, not off req.membership, so role changes apply at once. */
const requirePermission =
  (...permissions) =>
  async (req, res, next) => {
    try {
      if (!req.user) return unauthorized(res, "Unauthorized");

      if (!req.membership) {
        // Pre-membership account: admins keep the access they had.
        const legacyRole = req.user.role;
        if (legacyRole === ROLES.superadmin || legacyRole === ROLES.admin) return next();
        return forbidden(res, "Forbidden");
      }

      const granted = await Promise.all(
        permissions.map((permission) => membershipService.hasPermission(req.user._id, req.tenantId, permission)),
      );
      if (granted.some(Boolean)) return next();

      return forbidden(res, `Missing permission: ${permissions.join(" or ")}`);
    } catch (err) {
      return next(err);
    }
  };

const superadmin = requireRoles(ROLES.superadmin);
const admin = requireRoles(ROLES.admin, ROLES.superadmin);
const user = requireRoles(ROLES.user, ROLES.admin, ROLES.superadmin);

/** Any active tenant member; Staff included while permissions are off. */
const tenantMember = (req, res, next) => {
  if (!req.user) return unauthorized(res, "Unauthorized");
  // The platform superadmin belongs to no tenant, so has no tenant data here.
  if (!req.tenantId) return forbidden(res, "Select an organisation to continue");
  return next();
};

/** The tenant's Admin (owner): team management and anything else owner-only. */
const tenantAdmin = (req, res, next) => {
  if (!req.user) return unauthorized(res, "Unauthorized");
  if (!req.tenantId) return forbidden(res, "Select an organisation to continue");
  return membershipService.isRequestTenantAdmin(req) ? next() : forbidden(res, "Only an organisation Admin can do this");
};

module.exports = { auth, requireRoles, requirePermission, superadmin, admin, user, tenantMember, tenantAdmin };
