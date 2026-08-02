// middlewares/auth.js

const { unauthorized, forbidden } = require("../utils/http/response");
const { verifyJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Tenant = require("../models/Tenant");

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
      // Sourced from the User doc (not the JWT payload) so a tenant change
      // takes effect immediately rather than waiting for the token to expire.
      req.tenantId = user.tenant_id;
      if (user.tenant_id) {
        req.tenant = await Tenant.findById(user.tenant_id);
        if (!req.tenant) return forbidden(res, "Tenant not found or disabled");
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

// Shorthands
const superadmin = requireRoles(ROLES.superadmin);
const admin = requireRoles(ROLES.admin, ROLES.superadmin);
const user = requireRoles(ROLES.user, ROLES.admin, ROLES.superadmin);

module.exports = { auth, requireRoles, superadmin, admin, user };
