// routes/location.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/location.controller");

router.use(auth());

router.get("/", asyncHandler(ctrl.getLocations));
router.get("/:id", asyncHandler(ctrl.getLocation));
router.post("/", asyncHandler(ctrl.createLocation));
router.put("/:id", asyncHandler(ctrl.updateLocation));
router.delete("/:id", asyncHandler(ctrl.deleteLocation));

module.exports = router;
