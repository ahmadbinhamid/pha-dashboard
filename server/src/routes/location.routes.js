// routes/location.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const ctrl = require("../controllers/location.controller");

router.use(auth());

router.get("/", requirePermission("locations.view"), asyncHandler(ctrl.getLocations));
router.get("/:id", requirePermission("locations.view"), asyncHandler(ctrl.getLocation));
router.post("/", requirePermission("locations.create"), asyncHandler(ctrl.createLocation));
router.put("/:id", requirePermission("locations.update"), asyncHandler(ctrl.updateLocation));
router.delete("/:id", requirePermission("locations.delete"), asyncHandler(ctrl.deleteLocation));

module.exports = router;
