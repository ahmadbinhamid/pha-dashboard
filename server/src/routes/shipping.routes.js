// routes/shipping.routes.js
// Storefront shipping quotes (guest) and Transdirect settings (members).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/shipping.validation");
const ctrl = require("../controllers/shipping.controller");

// Guest: the storefront names its tenant via X-Tenant-Slug.
router.post("/quote", resolveGuestTenant(), validate(v.quote), asyncHandler(ctrl.quote));

router.get("/settings", auth(), requirePermission("shipping.view"), asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), requirePermission("shipping.update"), validate(v.updateSettings), asyncHandler(ctrl.updateSettings));
router.post("/settings/test", auth(), requirePermission("shipping.update"), asyncHandler(ctrl.testConnection));

module.exports = router;
