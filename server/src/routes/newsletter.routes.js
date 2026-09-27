// routes/newsletter.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/newsletter.validation");
const ctrl = require("../controllers/newsletter.controller");

// Storefront-submitted; resolves the tenant via X-Tenant-Slug so the notification lands in
// that tenant's own inbox, not a platform-wide address.
router.post("/", resolveGuestTenant(), validate(v.subscribe), asyncHandler(ctrl.subscribe));

module.exports = router;
