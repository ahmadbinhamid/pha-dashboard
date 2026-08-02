// routes/payment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/payment.validation");
const ctrl = require("../controllers/payment.controller");

// ── Guest-facing — no auth; storefront calls this to start checkout payment ──
router.post("/create-intent", resolveGuestTenant(), validate(v.createIntent), asyncHandler(ctrl.createIntent));

// ── Stripe webhook — no JWT auth (Stripe calls this), signature-verified ────
// Raw body is already captured globally for every request in app.js
// (express.json({ verify })), exactly like the eBay webhook — no express.raw()
// needed on this route specifically. BYOK: one shared URL for every tenant,
// resolved via the opaque ?wt= query param (see payment.controller.js).
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// ── Admin ─────────────────────────────────────────────────────────────────
router.get("/", auth(), admin, pagination(), validate(v.listPayments), asyncHandler(ctrl.listPayments));
router.get("/:id", auth(), admin, validate(v.byIdParam), asyncHandler(ctrl.getPayment));
// /:id/refund and /:id/refund-manual removed (refund-redesign-spec.md §9) —
// use POST /order/:orderId/refunds instead (order.routes.js).

module.exports = router;
