// routes/tenantSettings.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/tenantSettings.validation");
const ctrl = require("../controllers/tenantSettings.controller");

router.get("/", auth(), admin, asyncHandler(ctrl.getSettings));
router.patch("/", auth(), admin, validate(v.updateSettings), asyncHandler(ctrl.updateSettings));

router.put("/stripe/keys", auth(), admin, validate(v.updateStripeKeys), asyncHandler(ctrl.updateStripeKeys));
router.get("/stripe/status", auth(), admin, asyncHandler(ctrl.getStripeStatus));
router.put(
  "/stripe/webhook-secret",
  auth(),
  admin,
  validate(v.updateStripeWebhookSecret),
  asyncHandler(ctrl.updateStripeWebhookSecret),
);

router.put("/smtp/credentials", auth(), admin, validate(v.updateSmtpCredentials), asyncHandler(ctrl.updateSmtpCredentials));
router.get("/smtp/status", auth(), admin, asyncHandler(ctrl.getSmtpStatus));

module.exports = router;
