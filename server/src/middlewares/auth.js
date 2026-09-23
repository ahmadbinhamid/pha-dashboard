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

      // Loaded alongside the membership list, not after — both only depend on decoded.sub, so
      // running them serially was a wasted round trip on every request.
      const [user, memberships] = await Promise.all([
        User.findById(decoded.sub).select("-password"),
        membershipService.listUserMemberships(decoded.sub),
      ]);
      if (!user) return forbidden(res, "Account not found or disabled");

      req.auth = decoded;
      req.user = user;

      // Active org comes from X-Tenant-Id when named, else the default membership; validated
      // against the user's own memberships either way. Sourced per-request, not from the JWT,
      // so joining/leaving/switching orgs takes effect immediately.
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
        // Always the full tenant document, never the membership's populated (lean, partial)
        // copy — that broke generateNextSku, order/invoice prefixes, and payment_domain_mode.
        // Also matches what middlewares/tenant.js assigns for guest routes.
        req.tenant = await Tenant.findById(req.tenantId);
        req.permissions = active.role_id?.permissions ?? [];
      } else {
        // No membership row yet; fall back to the tenant stamped on the account and the
        // legacy User.role for permission checks.
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

/** Permission guard, e.g. requirePermission("users.create"). Queried live (not off
 * req.membership) so a role change takes effect immediately. Falls back to legacy User.role
 * for accounts with no membership row yet. */
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
