// routes/dashboard.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/dashboard.validation");
const ctrl = require("../controllers/dashboard.controller");

router.get("/stats", auth(), requirePermission("dashboard.view"), asyncHandler(ctrl.getStats));
router.get("/channels", auth(), requirePermission("dashboard.view"), asyncHandler(ctrl.getChannels));
router.get("/order-volume", auth(), requirePermission("dashboard.view"), validate(v.getOrderVolume), asyncHandler(ctrl.getOrderVolume));
router.get("/activity", auth(), requirePermission("dashboard.view"), validate(v.getActivity), asyncHandler(ctrl.getActivity));
router.get("/critical-stock", auth(), requirePermission("dashboard.view"), validate(v.getCriticalStock), asyncHandler(ctrl.getCriticalStock));
router.get("/activity-log", auth(), requirePermission("activity.view"), validate(v.listActivityLog), asyncHandler(ctrl.listActivityLog));
router.get(
  "/activity-log/analytics",
  auth(),
  requirePermission("activity.view"),
  validate(v.getActivityAnalytics),
  asyncHandler(ctrl.getActivityAnalytics),
);

module.exports = router;
