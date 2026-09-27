// routes/channel.routes.js
// Platform-generic channel API, alongside the per-platform routes.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const ctrl = require("../controllers/channel.controller");

router.get("/", auth(), requirePermission("listings.view"), asyncHandler(ctrl.listChannels));
router.get("/:platform/logs", auth(), requirePermission("listings.view"), pagination(), asyncHandler(ctrl.getLogs));
router.post("/:platform/retry/:logId", auth(), requirePermission("listings.update"), asyncHandler(ctrl.retryLog));

module.exports = router;
