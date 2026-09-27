// routes/tenantSettings.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/tenantSettings.validation");
const ctrl = require("../controllers/tenantSettings.controller");

router.get("/", auth(), tenantMember, asyncHandler(ctrl.getSettings));
router.patch("/", auth(), tenantMember, validate(v.updateSettings), asyncHandler(ctrl.updateSettings));

router.put("/stripe/keys", auth(), tenantMember, validate(v.updateStripeKeys), asyncHandler(ctrl.updateStripeKeys));
router.get("/stripe/status", auth(), tenantMember, asyncHandler(ctrl.getStripeStatus));
router.put(
  "/stripe/webhook-secret",
  auth(),
  tenantMember,
  validate(v.updateStripeWebhookSecret),
  asyncHandler(ctrl.updateStripeWebhookSecret),
);

router.put("/smtp/credentials", auth(), tenantMember, validate(v.updateSmtpCredentials), asyncHandler(ctrl.updateSmtpCredentials));
router.get("/smtp/status", auth(), tenantMember, asyncHandler(ctrl.getSmtpStatus));

module.exports = router;
