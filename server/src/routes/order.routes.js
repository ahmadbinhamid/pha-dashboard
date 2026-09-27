// routes/order.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/order.validation");
const rv = require("../validators/refund.validation");
const ctrl = require("../controllers/order.controller");
const refundCtrl = require("../controllers/refund.controller");

// Guest checkout, unauthenticated; GET uses guest_access_token, not a JWT.
router.post("/", resolveGuestTenant(), validate(v.createOrder), asyncHandler(ctrl.createOrder));

// Must precede the guest "/:id" route, which would otherwise swallow it.
router.get("/stats", auth(), tenantMember, asyncHandler(ctrl.getOrderStats));

router.get("/:id", resolveGuestTenant(), validate(v.byIdParam), asyncHandler(ctrl.getOrder));

// ── Organisation members ("/:id/detail" avoids the guest "/:id") ──
router.get("/", auth(), tenantMember, pagination(), validate(v.listOrders), asyncHandler(ctrl.listOrders));
router.post("/manual", auth(), tenantMember, validate(v.createManualOrder), asyncHandler(ctrl.createManualOrder));
router.get("/:id/detail", auth(), tenantMember, validate(v.adminByIdParam), asyncHandler(ctrl.getOrderDetail));
router.get(
  "/:id/invoice-pdf",
  auth(),
  tenantMember,
  validate(v.adminByIdParam),
  asyncHandler(ctrl.downloadInvoicePdf),
);
router.post("/:id/send-email", auth(), tenantMember, validate(v.sendOrderEmail), asyncHandler(ctrl.sendOrderEmail));
router.post(
  "/:id/payment-link",
  auth(),
  tenantMember,
  validate(v.generatePaymentLink),
  asyncHandler(ctrl.generatePaymentLink),
);
router.post(
  "/:id/payment-link/send",
  auth(),
  tenantMember,
  validate(v.sendPaymentLinkEmail),
  asyncHandler(ctrl.sendPaymentLinkEmail),
);
router.patch(
  "/:id/status",
  auth(),
  tenantMember,
  validate(v.updateOrderStatus),
  asyncHandler(ctrl.updateOrderStatus),
);
router.post("/:id/payments", auth(), tenantMember, validate(v.recordPayment), asyncHandler(ctrl.recordPayment));
router.put(
  "/:id/customer-details",
  auth(),
  tenantMember,
  validate(v.updateOrderCustomerDetails),
  asyncHandler(ctrl.updateOrderCustomerDetails),
);
router.post("/:id/notes", auth(), tenantMember, validate(v.addOrderNote), asyncHandler(ctrl.addOrderNote));
router.patch(
  "/:id/items/:itemIndex/price",
  auth(),
  tenantMember,
  validate(v.updateOrderItemPrice),
  asyncHandler(ctrl.updateOrderItemPrice),
);
router.patch(
  "/:id/shipping-cost",
  auth(),
  tenantMember,
  validate(v.updateOrderShippingCost),
  asyncHandler(ctrl.updateOrderShippingCost),
);
router.patch(
  "/:id/items/:itemIndex/discount",
  auth(),
  tenantMember,
  validate(v.updateOrderItemDiscount),
  asyncHandler(ctrl.updateOrderItemDiscount),
);
router.patch(
  "/:id/reference-number",
  auth(),
  tenantMember,
  validate(v.updateOrderReferenceNumber),
  asyncHandler(ctrl.updateOrderReferenceNumber),
);

// ── Refunds: order-scoped; items and payments allocate per order ──
router.get("/:id/refundable", auth(), tenantMember, validate(rv.getRefundable), asyncHandler(refundCtrl.getRefundable));
router.get("/:id/refunds", auth(), tenantMember, validate(rv.listRefunds), asyncHandler(refundCtrl.listRefunds));
router.post("/:id/refunds", auth(), tenantMember, validate(rv.createRefund), asyncHandler(refundCtrl.createRefund));

module.exports = router;
