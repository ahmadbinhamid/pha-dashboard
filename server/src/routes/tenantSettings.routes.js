// routes/tenantSettings.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/tenantSettings.validation");
const ctrl = require("../controllers/tenantSettings.controller");

router.get("/", auth(), admin, asyncHandler(ctrl.getSettings));
router.patch("/", auth(), admin, validate(v.updateSettings), asyncHandler(ctrl.updateSettings));

router.post("/stripe/connect", auth(), admin, asyncHandler(ctrl.connectStripe));
router.post("/stripe/account-session", auth(), admin, asyncHandler(ctrl.createStripeAccountSession));
router.get("/stripe/status", auth(), admin, asyncHandler(ctrl.getStripeStatus));

module.exports = router;
