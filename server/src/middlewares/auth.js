// middlewares/auth.js

const { unauthorized, forbidden } = require("../utils/http/response");
const { verifyJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const membershipService = require("../services/membership.service");
const { MEMBERSHIP_STATUS } = require("../constants/access.constants");

const ROLES = { superadmin: "superadmin", admin: "admin", user: "user" };

// extract token from Authorization: Bearer <token> or 'auth-token'
function extractToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  const t = req.header("auth-token");
  if (t) return t.trim();
  return null;
}

// Authenticate: verifies token, loads user, attaches to req.user and req.auth
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

      // soft-delete plugin hides deleted users by default
      const user = await User.findById(decoded.sub).select("-password");
      if (!user) return forbidden(res, "Account not found or disabled");

      req.auth = decoded;
      req.user = user;

      // Which organisation is this request for? A user can belong to several,
      // so the active one comes from the X-Tenant-Id header when the client
      // names one, and from their default membership otherwise. Either way it
      // is validated against their own memberships — a header can only ever
      // select between organisations they already belong to, never grant
      // access to one they don't.
      //
      // Sourced per-request rather than from the JWT so joining, leaving or
      // switching organisations takes effect immediately instead of waiting
      // for the token to expire.
      const memberships = await membershipService.listUserMemberships(user._id);
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
        // Always the FULL tenant document, never the membership's populated
        // copy: listUserMemberships projects tenant_id down to the handful of
        // fields an organisation switcher needs, and handing that partial
        // (and lean) object to the app broke everything reading a field
        // outside it — generateNextSku crashed on `tenant.code`, order and
        // invoice numbering lost their prefixes, and payment links silently
        // ignored payment_domain_mode. It also matches what
        // middlewares/tenant.js assigns for guest routes, so req.tenant is
        // one shape everywhere.
        req.tenant = await Tenant.findById(req.tenantId);
        req.permissions = active.role_id?.permissions ?? [];
      } else {
        // No membership row yet — a user created before memberships existed,
        // or one whose backfill hasn't run. Fall back to the tenant stamped on
        // the account so existing sessions keep working; permission checks
        // fall back to the legacy role on the User doc (see requirePermission).
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

// Role guard: allow if req.user.role is in allowed
const requireRoles =
  (...allowed) =>
  (req, res, next) => {
    const role = req.user?.role;
    if (!role) return unauthorized(res, "Unauthorized");
    if (!allowed.includes(role)) return forbidden(res, "Forbidden");
    return next();
  };

/**
 * Permission guard: `requirePermission("users.create")`.
 *
 * Checks the role held through the ACTIVE membership for the current
 * organisation (see membership.service.js#hasPermission — Super Admin
 * short-circuits to true). Falls back to the legacy User.role for accounts
 * that have no membership row yet, so routes can move onto permissions before
 * every account has been migrated.
 */
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

// Shorthands
const superadmin = requireRoles(ROLES.superadmin);
const admin = requireRoles(ROLES.admin, ROLES.superadmin);
const user = requireRoles(ROLES.user, ROLES.admin, ROLES.superadmin);

module.exports = { auth, requireRoles, requirePermission, superadmin, admin, user };
