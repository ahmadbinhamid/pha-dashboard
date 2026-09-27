// routes/payment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const { paymentLimiter } = require("../middlewares/rateLimit");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/payment.validation");
const ctrl = require("../controllers/payment.controller");

// ── Guest: no auth; the storefront starts checkout payment here ──
router.post(
  "/create-intent",
  paymentLimiter,
  resolveGuestTenant(),
  validate(v.createIntent),
  asyncHandler(ctrl.createIntent)
);

// ── Stripe webhook: no JWT, signature-verified; ?wt= picks tenant ──
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// ── Organisation members ──
router.get("/", auth(), tenantMember, pagination(), validate(v.listPayments), asyncHandler(ctrl.listPayments));
router.get("/:id", auth(), tenantMember, validate(v.byIdParam), asyncHandler(ctrl.getPayment));

module.exports = router;
