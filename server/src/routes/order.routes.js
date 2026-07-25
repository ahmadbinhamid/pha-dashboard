// routes/order.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/order.validation");
const ctrl = require("../controllers/order.controller");

// Guest checkout only — the storefront has no customer accounts, so these
// are intentionally unauthenticated. GET is gated by the per-order
// guest_access_token (query param) instead of a JWT.
router.post("/", validate(v.createOrder), asyncHandler(ctrl.createOrder));
router.get("/:id", validate(v.byIdParam), asyncHandler(ctrl.getOrder));

// ── Admin ─────────────────────────────────────────────────────────────────
// "/:id/detail" (not a bare "/:id") deliberately avoids colliding with the
// guest route above, which owns that exact path with different auth
// semantics (token-gated, no JWT).
router.get("/", auth(), admin, pagination(), validate(v.listOrders), asyncHandler(ctrl.listOrders));
router.post("/manual", auth(), admin, validate(v.createManualOrder), asyncHandler(ctrl.createManualOrder));
router.get("/:id/detail", auth(), admin, validate(v.adminByIdParam), asyncHandler(ctrl.getOrderDetail));
router.post("/:id/send-email", auth(), admin, validate(v.sendOrderEmail), asyncHandler(ctrl.sendOrderEmail));
router.post(
  "/:id/payment-link",
  auth(),
  admin,
  validate(v.generatePaymentLink),
  asyncHandler(ctrl.generatePaymentLink),
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

module.exports = router;
