// routes/refund.routes.js
// Acts on a refund by its own id, not nested under an order.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/refund.validation");
const ctrl = require("../controllers/refund.controller");

router.post("/:id/void", auth(), requirePermission("orders.refund"), validate(v.voidRefund), asyncHandler(ctrl.voidRefund));
router.post("/:id/retry-restock", auth(), requirePermission("orders.refund"), validate(v.retryRestock), asyncHandler(ctrl.retryRestock));

module.exports = router;
