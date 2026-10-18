// routes/discount.routes.js
// Storefront discounts, managed by members.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/discount.validation");
const ctrl = require("../controllers/discount.controller");

router.get("/", auth(), requirePermission("discounts.view"), asyncHandler(ctrl.listDiscounts));
router.post("/", auth(), requirePermission("discounts.create"), validate(v.createDiscount), asyncHandler(ctrl.createDiscount));
router.get("/:id", auth(), requirePermission("discounts.view"), validate(v.byIdParam), asyncHandler(ctrl.getDiscount));
router.patch("/:id", auth(), requirePermission("discounts.update"), validate(v.updateDiscount), asyncHandler(ctrl.updateDiscount));
router.delete("/:id", auth(), requirePermission("discounts.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteDiscount));

module.exports = router;
