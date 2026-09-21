// routes/demoRequest.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { publicFormLimiter } = require("../middlewares/rateLimit");
const v = require("../validators/demoRequest.validation");
const ctrl = require("../controllers/demoRequest.controller");

// Marketing-site submitted — unlike inquiry/newsletter this has no tenant to
// resolve (the submitter has no account yet), so it always lands in the
// platform's own inbox (config.smtp.alertsTo). Rate-limited: unauthenticated
// and every submission queues a real email send.
router.post("/", publicFormLimiter, validate(v.submit), asyncHandler(ctrl.submit));

module.exports = router;
