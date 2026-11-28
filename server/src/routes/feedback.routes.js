// routes/feedback.routes.js
// Public feedback form and opt-out, opened from follow-up emails.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const v = require("../validators/followup.validation");
const ctrl = require("../controllers/followup.controller");

router.get("/public/:token", validate(v.token), asyncHandler(ctrl.getFeedbackForm));
router.post("/public/:token", validate(v.submitFeedback), asyncHandler(ctrl.submitFeedback));
router.get("/opt-out/:token", validate(v.token), asyncHandler(ctrl.optOutPage));
router.post("/opt-out/:token", validate(v.token), asyncHandler(ctrl.optOut));

module.exports = router;
