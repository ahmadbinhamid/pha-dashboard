// routes/notification.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/notification.validation");
const ctrl = require("../controllers/notification.controller");

// Members only; notifications are created for tenant staff.
router.get("/", auth(), tenantMember, pagination(), validate(v.listNotifications), asyncHandler(ctrl.listNotifications));
router.patch("/read-all", auth(), tenantMember, validate(v.markAllAsRead), asyncHandler(ctrl.markAllAsRead));
// The signed-in user's own settings, so no extra permission is needed.
router.get("/preferences", auth(), tenantMember, asyncHandler(ctrl.getPreferences));
router.put("/preferences", auth(), tenantMember, validate(v.updatePreferences), asyncHandler(ctrl.updatePreferences));
router.patch("/:id/read", auth(), tenantMember, validate(v.byIdParam), asyncHandler(ctrl.markAsRead));

module.exports = router;
