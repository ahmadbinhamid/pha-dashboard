// routes/campaign.routes.js
// Email campaigns and newsletters, plus the public unsubscribe endpoints.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const validate = require("../middlewares/validate");
const v = require("../validators/campaign.validation");
const ctrl = require("../controllers/campaign.controller");

// Public: opened from emails, the unguessable token is the only credential.
router.get("/unsubscribe/:token", validate(v.unsubscribe), asyncHandler(ctrl.unsubscribePage));
router.post("/unsubscribe/:token", validate(v.unsubscribe), asyncHandler(ctrl.unsubscribe));

router.use("/contacts", require("./contact.routes"));
router.use("/", require("./follow-up.routes"));

const canView = requirePermission("campaigns.view");
const canSend = requirePermission("campaigns.send");

router.get("/", auth(), canView, validate(v.listCampaigns), pagination(), asyncHandler(ctrl.listCampaigns));
router.post("/audience-count", auth(), canView, validate(v.audienceCount), asyncHandler(ctrl.countAudience));
router.post("/preview", auth(), canView, validate(v.previewCampaign), asyncHandler(ctrl.previewCampaign));
router.get("/templates", auth(), canView, asyncHandler(ctrl.listTemplates));
router.post("/templates", auth(), requirePermission("campaigns.create"), validate(v.createTemplate), asyncHandler(ctrl.createTemplate));
router.patch("/templates/:id", auth(), requirePermission("campaigns.update"), validate(v.updateTemplate), asyncHandler(ctrl.updateTemplate));
router.delete("/templates/:id", auth(), requirePermission("campaigns.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteTemplate));
router.post("/", auth(), requirePermission("campaigns.create"), validate(v.createCampaign), asyncHandler(ctrl.createCampaign));
router.get("/:id", auth(), canView, validate(v.byIdParam), asyncHandler(ctrl.getCampaign));
router.patch("/:id", auth(), requirePermission("campaigns.update"), validate(v.updateCampaign), asyncHandler(ctrl.updateCampaign));
router.delete("/:id", auth(), requirePermission("campaigns.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteCampaign));
router.post("/:id/duplicate", auth(), requirePermission("campaigns.create"), validate(v.byIdParam), asyncHandler(ctrl.duplicateCampaign));
router.post("/:id/send", auth(), canSend, validate(v.byIdParam), asyncHandler(ctrl.sendCampaign));
router.post("/:id/schedule", auth(), canSend, validate(v.scheduleCampaign), asyncHandler(ctrl.scheduleCampaign));
router.post("/:id/pause", auth(), canSend, validate(v.byIdParam), asyncHandler(ctrl.pauseCampaign));
router.post("/:id/test", auth(), requirePermission("campaigns.update", "campaigns.send"), validate(v.testCampaign), asyncHandler(ctrl.sendTestEmail));

module.exports = router;
