// routes/vehicle-model.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/vehicle-model.validation");
const ctrl = require("../controllers/vehicle-model.controller");

// No hard auth requirement, but tenant context still matters: the global catalog is always
// visible, but a tenant's own custom entries stay scoped to that tenant. Same pattern as product.routes.js.
router.use(auth(false), resolveGuestTenant());

router.get("/makes", asyncHandler(ctrl.getMakes));
router.get("/models", validate(v.listModels), asyncHandler(ctrl.getModels));
router.get("/model-codes", validate(v.listModelCodes), asyncHandler(ctrl.getModelCodes));
router.get("/years", validate(v.getYears), asyncHandler(ctrl.getYears));

module.exports = router;
