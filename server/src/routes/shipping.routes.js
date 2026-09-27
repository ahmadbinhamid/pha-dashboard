// routes/shipping.routes.js
// Storefront shipping quotes (guest) and Transdirect settings (admin).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/shipping.validation");
const ctrl = require("../controllers/shipping.controller");

// Guest: the storefront names its tenant via X-Tenant-Slug.
router.post("/quote", resolveGuestTenant(), validate(v.quote), asyncHandler(ctrl.quote));

router.get("/settings", auth(), admin, asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), admin, validate(v.updateSettings), asyncHandler(ctrl.updateSettings));
router.post("/settings/test", auth(), admin, asyncHandler(ctrl.testConnection));

module.exports = router;
