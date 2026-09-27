const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const asyncHandler = require("../middlewares/asyncHandler");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const V = require("../validators/inquiry.validation");
const ctrl = require("../controllers/inquiry.controller");

// Storefront-submitted; resolves the tenant via X-Tenant-Slug so the notification lands in
// that tenant's own inbox, not a platform-wide address.
router.post("/", resolveGuestTenant(), upload.none(), validate(V.submit), asyncHandler(ctrl.submit));

module.exports = router;
