// routes/payment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/payment.validation");
const ctrl = require("../controllers/payment.controller");

// ── Guest-facing — no auth; storefront calls this to start checkout payment ──
router.post("/create-intent", validate(v.createIntent), asyncHandler(ctrl.createIntent));

// ── Stripe webhook — no JWT auth (Stripe calls this), signature-verified ────
// Raw body is already captured globally for every request in app.js
// (express.json({ verify })), exactly like the eBay webhook — no express.raw()
// needed on this route specifically.
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// ── Admin ─────────────────────────────────────────────────────────────────
router.get("/", auth(), admin, pagination(), validate(v.listPayments), asyncHandler(ctrl.listPayments));
router.get("/:id", auth(), admin, validate(v.byIdParam), asyncHandler(ctrl.getPayment));
router.post(
  "/:id/refund",
  auth(),
  admin,
  validate(v.createRefund),
  asyncHandler(ctrl.refundPayment),
);
router.post(
  "/:id/refund-manual",
  auth(),
  admin,
  validate(v.createManualRefund),
  asyncHandler(ctrl.refundPaymentManual),
);

module.exports = router;
