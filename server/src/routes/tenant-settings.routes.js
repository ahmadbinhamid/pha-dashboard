// routes/tenant-settings.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/tenant-settings.validation");
const ctrl = require("../controllers/tenant-settings.controller");

router.get("/", auth(), tenantMember, asyncHandler(ctrl.getSettings));
router.patch("/", auth(), requirePermission("settings.update"), validate(v.updateSettings), asyncHandler(ctrl.updateSettings));

router.put("/stripe/keys", auth(), requirePermission("integrations.update"), validate(v.updateStripeKeys), asyncHandler(ctrl.updateStripeKeys));
router.get("/stripe/status", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getStripeStatus));
router.put(
  "/stripe/webhook-secret",
  auth(),
  requirePermission("integrations.update"),
  validate(v.updateStripeWebhookSecret),
  asyncHandler(ctrl.updateStripeWebhookSecret),
);

router.put("/smtp/credentials", auth(), requirePermission("integrations.update"), validate(v.updateSmtpCredentials), asyncHandler(ctrl.updateSmtpCredentials));
router.get("/smtp/status", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getSmtpStatus));

module.exports = router;
