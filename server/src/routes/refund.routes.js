// routes/refund.routes.js
// These two act on a specific refund by its own id, not nested under an order like order.routes.js.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/refund.validation");
const ctrl = require("../controllers/refund.controller");

router.post("/:id/void", auth(), admin, validate(v.voidRefund), asyncHandler(ctrl.voidRefund));
router.post("/:id/retry-restock", auth(), admin, validate(v.retryRestock), asyncHandler(ctrl.retryRestock));

module.exports = router;
