// routes/vehicle-model.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/vehicle-model.validation");
const ctrl = require("../controllers/vehicle-model.controller");

// No hard auth requirement — consumed by the dashboard (staff JWT), the
// storefront, and any other guest surface (X-Tenant-Slug header). Tenant
// context still matters even though there's no login: the shared/global
// catalog is always visible, but a tenant's own custom entries must only
// ever be visible within that tenant's own context — see
// vehicle-model.service.js. auth(false) resolves req.tenant from a staff
// JWT when present; resolveGuestTenant() fills in from X-Tenant-Slug
// otherwise, same pattern as product.routes.js.
router.use(auth(false), resolveGuestTenant());

router.get("/makes", asyncHandler(ctrl.getMakes));
router.get("/models", validate(v.listModels), asyncHandler(ctrl.getModels));
router.get("/model-codes", validate(v.listModelCodes), asyncHandler(ctrl.getModelCodes));
router.get("/years", validate(v.getYears), asyncHandler(ctrl.getYears));

module.exports = router;
