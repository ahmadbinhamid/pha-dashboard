// routes/payment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const { paymentLimiter } = require("../middlewares/rateLimit");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/payment.validation");
const ctrl = require("../controllers/payment.controller");

// ── Guest-facing — no auth; storefront calls this to start checkout payment ──
router.post(
  "/create-intent",
  paymentLimiter,
  resolveGuestTenant(),
  validate(v.createIntent),
  asyncHandler(ctrl.createIntent)
);

// ── Stripe webhook — no JWT auth (Stripe calls this), signature-verified ────
// Raw body already captured globally in app.js, like the eBay webhook. BYOK: one shared URL,
// resolved via the opaque ?wt= query param.
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// ── Admin ─────────────────────────────────────────────────────────────────
router.get("/", auth(), admin, pagination(), validate(v.listPayments), asyncHandler(ctrl.listPayments));
router.get("/:id", auth(), admin, validate(v.byIdParam), asyncHandler(ctrl.getPayment));
// /:id/refund and /:id/refund-manual removed — use POST /order/:orderId/refunds instead.

module.exports = router;
