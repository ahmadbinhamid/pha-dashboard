// routes/dashboard.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/dashboard.validation");
const ctrl = require("../controllers/dashboard.controller");

router.get("/stats", auth(), tenantMember, asyncHandler(ctrl.getStats));
router.get("/channels", auth(), tenantMember, asyncHandler(ctrl.getChannels));
router.get("/order-volume", auth(), tenantMember, validate(v.getOrderVolume), asyncHandler(ctrl.getOrderVolume));
router.get("/activity", auth(), tenantMember, validate(v.getActivity), asyncHandler(ctrl.getActivity));
router.get("/critical-stock", auth(), tenantMember, validate(v.getCriticalStock), asyncHandler(ctrl.getCriticalStock));
router.get("/activity-log", auth(), tenantMember, validate(v.listActivityLog), asyncHandler(ctrl.listActivityLog));
router.get(
  "/activity-log/analytics",
  auth(),
  tenantMember,
  validate(v.getActivityAnalytics),
  asyncHandler(ctrl.getActivityAnalytics),
);

module.exports = router;
