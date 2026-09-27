// routes/reports.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/reports.validation");
const ctrl = require("../controllers/reports.controller");

router.get("/summary", auth(), tenantMember, validate(v.getSummary), asyncHandler(ctrl.getSummary));
router.get("/revenue-by-channel", auth(), tenantMember, validate(v.getRevenueByChannel), asyncHandler(ctrl.getRevenueByChannel));
router.get("/top-categories", auth(), tenantMember, validate(v.getTopCategories), asyncHandler(ctrl.getTopCategories));
router.get("/sales-performance", auth(), tenantMember, validate(v.getSalesPerformance), asyncHandler(ctrl.getSalesPerformance));
router.get("/inventory-turnover", auth(), tenantMember, validate(v.getInventoryTurnover), asyncHandler(ctrl.getInventoryTurnover));

module.exports = router;
