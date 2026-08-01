// middlewares/tenant.js
//
// Resolves tenant context for routes with no JWT (guest storefront checkout,
// public product browsing, the shared payment-link page). auth() already
// attaches req.tenant/req.tenantId when a valid staff JWT is present (admin
// browsing the same routes) — this middleware fills the gap for genuinely
// unauthenticated callers, via two possible signals:
//
//  1. A tenant identifier the CALLER already knows (X-Tenant-Slug header,
//     or tenant_slug in body/query) — used by each tenant's own separately-
//     deployed storefront, which always knows its own slug.
//  2. The order itself, when the caller only has an order id and guest
//     token and no notion of "which tenant's storefront" it's on — used by
//     the shared payment-link page (/pay/:orderId in the dashboard), which
//     is one page shared by every tenant and can't carry a fixed identity.
//     Every Order already stores its own tenant_id, so the id alone is
//     enough — no slug needed.

const { badRequest, notFound } = require("../utils/http/response");
const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Order = require("../models/Order");
const { TENANT_STATUS } = require("../constants/tenant.constants");

function extractTenantSlug(req) {
  const header = req.header("X-Tenant-Slug");
  if (header) return header.trim().toLowerCase();
  if (req.body?.tenant_slug) return String(req.body.tenant_slug).trim().toLowerCase();
  if (req.query?.tenant_slug) return String(req.query.tenant_slug).trim().toLowerCase();
  return null;
}

// Only checks places an order id could legitimately arrive on these guest
// routes — never trusts an arbitrary field an attacker could set to probe
// for a different tenant, since the id itself grants no access (the
// guest_access_token, checked separately downstream, still gates the data).
function extractOrderId(req) {
  const candidate = req.params?.id || req.body?.order_id;
  return candidate && mongoose.Types.ObjectId.isValid(candidate) ? candidate : null;
}

async function resolveTenantFromOrderId(orderId) {
  const order = await Order.findById(orderId).select("tenant_id");
  if (!order) return null;
  return Tenant.findOne({ _id: order.tenant_id, status: TENANT_STATUS.ACTIVE });
}

// Apply AFTER auth(false)/auth(true) on routes reachable by both staff and
// guests — if auth() already resolved a tenant from the JWT, this is a no-op.
const resolveGuestTenant = () => async (req, res, next) => {
  try {
    if (req.tenant) return next();

    const slug = extractTenantSlug(req);
    if (slug) {
      const tenant = await Tenant.findOne({ slug, status: TENANT_STATUS.ACTIVE });
      if (!tenant) return notFound(res, "Tenant not found");
      req.tenant = tenant;
      req.tenantId = tenant._id;
      return next();
    }

    const orderId = extractOrderId(req);
    if (orderId) {
      const tenant = await resolveTenantFromOrderId(orderId);
      if (!tenant) return notFound(res, "Order not found");
      req.tenant = tenant;
      req.tenantId = tenant._id;
      return next();
    }

    return badRequest(res, "Missing tenant identifier (X-Tenant-Slug header or a valid order id)");
  } catch (err) {
    return next(err);
  }
};

module.exports = { resolveGuestTenant };
