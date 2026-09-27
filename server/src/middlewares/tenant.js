// middlewares/tenant.js
// Resolves tenant context for routes with no JWT, via two signals: a known tenant identifier
// (X-Tenant-Slug or tenant_slug, used by each tenant's own storefront), or the order itself
// (used by the shared payment-link page, since every Order stores its own tenant_id).

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

// Only checks places an order id could legitimately arrive; the id grants no access on its
// own since guest_access_token is checked separately downstream.
function extractOrderId(req) {
  const candidate = req.params?.id || req.body?.order_id;
  return candidate && mongoose.Types.ObjectId.isValid(candidate) ? candidate : null;
}

async function resolveTenantFromOrderId(orderId) {
  const order = await Order.findById(orderId).select("tenant_id");
  if (!order) return null;
  return Tenant.findOne({ _id: order.tenant_id, status: TENANT_STATUS.ACTIVE });
}

// Apply after auth() on routes reachable by both staff and guests; a no-op if auth() already resolved a tenant.
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
