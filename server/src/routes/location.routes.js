// routes/location.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/location.validation");
const ctrl = require("../controllers/location.controller");

router.use(auth());

router.get("/", requirePermission("locations.view"), asyncHandler(ctrl.getLocations));
router.get("/:id", requirePermission("locations.view"), asyncHandler(ctrl.getLocation));
router.post("/", requirePermission("locations.create"), validate(v.createLocation), asyncHandler(ctrl.createLocation));
router.put("/:id", requirePermission("locations.update"), validate(v.updateLocation), asyncHandler(ctrl.updateLocation));
router.delete("/:id", requirePermission("locations.delete"), asyncHandler(ctrl.deleteLocation));

module.exports = router;
