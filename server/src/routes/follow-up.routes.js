// routes/follow-up.routes.js
// Follow-up emails and the feedback they collect, under /campaigns.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const validate = require("../middlewares/validate");
const v = require("../validators/followup.validation");
const ctrl = require("../controllers/followup.controller");

const canView = requirePermission("campaigns.view");

router.get("/follow-ups", auth(), canView, asyncHandler(ctrl.listFollowUps));
router.post("/follow-ups", auth(), requirePermission("campaigns.create"), validate(v.createFollowUp), asyncHandler(ctrl.createFollowUp));
router.post("/follow-ups/preview", auth(), canView, validate(v.previewFollowUp), asyncHandler(ctrl.previewFollowUp));
router.get("/follow-ups/:id", auth(), canView, validate(v.byIdParam), asyncHandler(ctrl.getFollowUp));
router.patch("/follow-ups/:id", auth(), requirePermission("campaigns.update"), validate(v.updateFollowUp), asyncHandler(ctrl.updateFollowUp));
router.post("/follow-ups/:id/enabled", auth(), requirePermission("campaigns.send"), validate(v.setEnabled), asyncHandler(ctrl.setEnabled));
router.delete("/follow-ups/:id", auth(), requirePermission("campaigns.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteFollowUp));

router.get("/feedback", auth(), canView, validate(v.listFeedback), pagination({ defaultLimit: 25 }), asyncHandler(ctrl.listFeedback));
router.get("/feedback/stats", auth(), canView, asyncHandler(ctrl.getFeedbackStats));

module.exports = router;
