// routes/newsletter.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const v = require("../validators/newsletter.validation");
const ctrl = require("../controllers/newsletter.controller");

router.post("/", validate(v.subscribe), asyncHandler(ctrl.subscribe));

module.exports = router;
