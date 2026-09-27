// routes/order.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
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
router.get("/stats", auth(), requirePermission("orders.view"), asyncHandler(ctrl.getOrderStats));

router.get("/:id", resolveGuestTenant(), validate(v.byIdParam), asyncHandler(ctrl.getOrder));

// ── Organisation members ("/:id/detail" avoids the guest "/:id") ──
router.get("/", auth(), requirePermission("orders.view"), pagination(), validate(v.listOrders), asyncHandler(ctrl.listOrders));
router.post("/manual", auth(), requirePermission("orders.create"), validate(v.createManualOrder), asyncHandler(ctrl.createManualOrder));
router.get("/:id/detail", auth(), requirePermission("orders.view"), validate(v.adminByIdParam), asyncHandler(ctrl.getOrderDetail));
router.get(
  "/:id/invoice-pdf",
  auth(),
  requirePermission("orders.view"),
  validate(v.adminByIdParam),
  asyncHandler(ctrl.downloadInvoicePdf),
);
router.post("/:id/send-email", auth(), requirePermission("orders.update"), validate(v.sendOrderEmail), asyncHandler(ctrl.sendOrderEmail));
router.post(
  "/:id/payment-link",
  auth(),
  requirePermission("payments.create"),
  validate(v.generatePaymentLink),
  asyncHandler(ctrl.generatePaymentLink),
);
router.post(
  "/:id/payment-link/send",
  auth(),
  requirePermission("payments.create"),
  validate(v.sendPaymentLinkEmail),
  asyncHandler(ctrl.sendPaymentLinkEmail),
);
router.patch(
  "/:id/status",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderStatus),
  asyncHandler(ctrl.updateOrderStatus),
);
router.post("/:id/payments", auth(), requirePermission("payments.create"), validate(v.recordPayment), asyncHandler(ctrl.recordPayment));
router.put(
  "/:id/customer-details",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderCustomerDetails),
  asyncHandler(ctrl.updateOrderCustomerDetails),
);
router.post("/:id/notes", auth(), requirePermission("orders.update"), validate(v.addOrderNote), asyncHandler(ctrl.addOrderNote));
router.patch(
  "/:id/items/:itemIndex/price",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderItemPrice),
  asyncHandler(ctrl.updateOrderItemPrice),
);
router.patch(
  "/:id/shipping-cost",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderShippingCost),
  asyncHandler(ctrl.updateOrderShippingCost),
);
router.patch(
  "/:id/items/:itemIndex/discount",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderItemDiscount),
  asyncHandler(ctrl.updateOrderItemDiscount),
);
router.patch(
  "/:id/reference-number",
  auth(),
  requirePermission("orders.update"),
  validate(v.updateOrderReferenceNumber),
  asyncHandler(ctrl.updateOrderReferenceNumber),
);

// ── Refunds: order-scoped; items and payments allocate per order ──
router.get("/:id/refundable", auth(), requirePermission("orders.view"), validate(rv.getRefundable), asyncHandler(refundCtrl.getRefundable));
router.get("/:id/refunds", auth(), requirePermission("orders.view"), validate(rv.listRefunds), asyncHandler(refundCtrl.listRefunds));
router.post("/:id/refunds", auth(), requirePermission("orders.refund"), validate(rv.createRefund), asyncHandler(refundCtrl.createRefund));

module.exports = router;
