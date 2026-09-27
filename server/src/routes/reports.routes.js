// routes/reports.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/reports.validation");
const ctrl = require("../controllers/reports.controller");

router.get("/summary", auth(), requirePermission("reports.view"), validate(v.getSummary), asyncHandler(ctrl.getSummary));
router.get("/revenue-by-channel", auth(), requirePermission("reports.view"), validate(v.getRevenueByChannel), asyncHandler(ctrl.getRevenueByChannel));
router.get("/top-categories", auth(), requirePermission("reports.view"), validate(v.getTopCategories), asyncHandler(ctrl.getTopCategories));
router.get("/sales-performance", auth(), requirePermission("reports.view"), validate(v.getSalesPerformance), asyncHandler(ctrl.getSalesPerformance));
router.get("/inventory-turnover", auth(), requirePermission("reports.view"), validate(v.getInventoryTurnover), asyncHandler(ctrl.getInventoryTurnover));

module.exports = router;
