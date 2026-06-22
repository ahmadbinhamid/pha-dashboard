// routes/ebay.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/ebay.controller");

router.get("/status", auth(), asyncHandler(ctrl.getStatus));
router.get("/settings", auth(), asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), asyncHandler(ctrl.updateSettings));

module.exports = router;
