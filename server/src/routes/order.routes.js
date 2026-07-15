// routes/order.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const v = require("../validators/order.validation");
const ctrl = require("../controllers/order.controller");

// Guest checkout only — the storefront has no customer accounts, so these
// are intentionally unauthenticated. GET is gated by the per-order
// guest_access_token (query param) instead of a JWT.
router.post("/", validate(v.createOrder), asyncHandler(ctrl.createOrder));
router.get("/:id", validate(v.byIdParam), asyncHandler(ctrl.getOrder));

module.exports = router;
