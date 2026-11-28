// routes/newsletter.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/newsletter.validation");
const ctrl = require("../controllers/newsletter.controller");

// Storefront signup; X-Tenant-Slug picks whose contact list it joins.
router.post("/", resolveGuestTenant(), validate(v.subscribe), asyncHandler(ctrl.subscribe));

module.exports = router;
