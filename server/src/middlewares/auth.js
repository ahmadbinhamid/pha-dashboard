// middlewares/auth.js

const { unauthorized, forbidden } = require("../utils/http/response");
const { verifyJwt } = require("../utils/auth/jwt");
const userService = require("../services/user.service");
const tenantService = require("../services/tenant.service");
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
        decoded = verifyJwt(token);
      } catch {
        return unauthorized(res, "Invalid or expired token");
      }

      // Parallel: both depend only on decoded.sub.
      const [user, memberships] = await Promise.all([
        userService.findUserForAuth(decoded.sub),
        membershipService.listMembershipsForAuth(decoded.sub),
      ]);
      if (!user) return forbidden(res, "Account not found or disabled");

      req.auth = decoded;
      req.user = user;

      // Per request, not from the JWT, so org switches/joins apply immediately.
      const requestedTenantId = req.header("x-tenant-id");
      const active = requestedTenantId
        ? memberships.find((m) => String(m.tenant_id) === String(requestedTenantId))
        : memberships.find((m) => m.is_default) || memberships[0];

      if (requestedTenantId && !active) {
        return forbidden(res, "You don't have access to that organisation");
      }

      // NOTE: no active membership means no tenant; User.tenant_id grants nothing.
      if (active) {
        req.membership = active;
        membershipService.touchLastActive(active);
        req.tenantId = active.tenant_id;
        // Full Mongoose doc; SKU/prefix code needs every field.
        req.tenant = await tenantService.findTenantById(req.tenantId);
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

/** Passes when the caller holds any of `permissions` in the current tenant. */
// auth() reloads the membership each request, so role edits apply at once.
const requirePermission =
  (...permissions) =>
  (req, res, next) => {
    if (!req.user) return unauthorized(res, "Unauthorized");
    // The platform superadmin belongs to no tenant, so has no tenant data here.
    if (!req.tenantId) return forbidden(res, "Select an organisation to continue");
    const granted = membershipService.requestPermissions(req);
    if (permissions.some((p) => granted.includes(p))) return next();
    return forbidden(res, `Missing permission: ${permissions.join(" or ")}`);
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
