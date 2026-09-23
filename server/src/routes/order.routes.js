// routes/order.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/order.validation");
const rv = require("../validators/refund.validation");
const ctrl = require("../controllers/order.controller");
const refundCtrl = require("../controllers/refund.controller");

// Guest checkout only, intentionally unauthenticated. GET is gated by guest_access_token instead of a JWT.
router.post("/", resolveGuestTenant(), validate(v.createOrder), asyncHandler(ctrl.createOrder));

// Registered ahead of the guest "/:id" route below, or it'd be swallowed by that catch-all.
router.get("/stats", auth(), admin, asyncHandler(ctrl.getOrderStats));

router.get("/:id", resolveGuestTenant(), validate(v.byIdParam), asyncHandler(ctrl.getOrder));

// ── Admin ─────────────────────────────────────────────────────────────────
// "/:id/detail" avoids colliding with the guest route above, which owns "/:id" with different auth.
router.get("/", auth(), admin, pagination(), validate(v.listOrders), asyncHandler(ctrl.listOrders));
router.post("/manual", auth(), admin, validate(v.createManualOrder), asyncHandler(ctrl.createManualOrder));
router.get("/:id/detail", auth(), admin, validate(v.adminByIdParam), asyncHandler(ctrl.getOrderDetail));
router.get(
  "/:id/invoice-pdf",
  auth(),
  admin,
  validate(v.adminByIdParam),
  asyncHandler(ctrl.downloadInvoicePdf),
);
router.post("/:id/send-email", auth(), admin, validate(v.sendOrderEmail), asyncHandler(ctrl.sendOrderEmail));
router.post(
  "/:id/payment-link",
  auth(),
  admin,
  validate(v.generatePaymentLink),
  asyncHandler(ctrl.generatePaymentLink),
);
router.post(
  "/:id/payment-link/send",
  auth(),
  admin,
  validate(v.sendPaymentLinkEmail),
  asyncHandler(ctrl.sendPaymentLinkEmail),
);
router.patch(
  "/:id/status",
  auth(),
  admin,
  validate(v.updateOrderStatus),
  asyncHandler(ctrl.updateOrderStatus),
);
router.post("/:id/payments", auth(), admin, validate(v.recordPayment), asyncHandler(ctrl.recordPayment));
router.put(
  "/:id/customer-details",
  auth(),
  admin,
  validate(v.updateOrderCustomerDetails),
  asyncHandler(ctrl.updateOrderCustomerDetails),
);
router.post("/:id/notes", auth(), admin, validate(v.addOrderNote), asyncHandler(ctrl.addOrderNote));
router.patch(
  "/:id/items/:itemIndex/price",
  auth(),
  admin,
  validate(v.updateOrderItemPrice),
  asyncHandler(ctrl.updateOrderItemPrice),
);
router.patch(
  "/:id/shipping-cost",
  auth(),
  admin,
  validate(v.updateOrderShippingCost),
  asyncHandler(ctrl.updateOrderShippingCost),
);
router.patch(
  "/:id/items/:itemIndex/discount",
  auth(),
  admin,
  validate(v.updateOrderItemDiscount),
  asyncHandler(ctrl.updateOrderItemDiscount),
);
router.patch(
  "/:id/reference-number",
  auth(),
  admin,
  validate(v.updateOrderReferenceNumber),
  asyncHandler(ctrl.updateOrderReferenceNumber),
);

// ── Refunds: order-scoped, not payment-scoped — line items and multi-payment allocation are
// order-level concerns. Mounted under /order for consistency with every other route here.
router.get("/:id/refundable", auth(), admin, validate(rv.getRefundable), asyncHandler(refundCtrl.getRefundable));
router.get("/:id/refunds", auth(), admin, validate(rv.listRefunds), asyncHandler(refundCtrl.listRefunds));
router.post("/:id/refunds", auth(), admin, validate(rv.createRefund), asyncHandler(refundCtrl.createRefund));

module.exports = router;
