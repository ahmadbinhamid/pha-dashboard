// routes/demo-request.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { publicFormLimiter } = require("../middlewares/rateLimit");
const v = require("../validators/demo-request.validation");
const ctrl = require("../controllers/demo-request.controller");

// Marketing-site submitted; unlike inquiry/newsletter, no tenant to resolve, so it always lands
// in the platform's own inbox. Rate-limited since every submission queues a real email send.
router.post("/", publicFormLimiter, validate(v.submit), asyncHandler(ctrl.submit));

module.exports = router;
