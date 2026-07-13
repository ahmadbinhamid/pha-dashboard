// routes/vehicle-model.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const v = require("../validators/vehicle-model.validation");
const ctrl = require("../controllers/vehicle-model.controller");

// Public routes — consumed by the dashboard, mobile app, and storefront
router.get("/makes", asyncHandler(ctrl.getMakes));
router.get("/models", validate(v.listModels), asyncHandler(ctrl.getModels));
router.get("/model-codes", validate(v.listModelCodes), asyncHandler(ctrl.getModelCodes));
router.get("/years", validate(v.getYears), asyncHandler(ctrl.getYears));

module.exports = router;
