// routes/storefront.routes.js
// Storefront content: public read (guest) and editing (members).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const v = require("../validators/storefront.validation");
const ctrl = require("../controllers/storefront.controller");

// Guest: the storefront names its tenant via X-Tenant-Slug.
router.get("/public", resolveGuestTenant(), asyncHandler(ctrl.getPublic));

router.get("/settings", auth(), requirePermission("storefront.view"), asyncHandler(ctrl.getSettings));
router.put(
  "/settings/hero-slides",
  auth(),
  requirePermission("storefront.update"),
  validate(v.updateHeroSlides),
  asyncHandler(ctrl.updateHeroSlides),
);
router.patch(
  "/settings/hero-settings",
  auth(),
  requirePermission("storefront.update"),
  validate(v.updateHeroSettings),
  asyncHandler(ctrl.updateHeroSettings),
);
router.patch(
  "/settings/announcement",
  auth(),
  requirePermission("storefront.update"),
  validate(v.updateAnnouncement),
  asyncHandler(ctrl.updateAnnouncement),
);
router.patch(
  "/settings/flash-sale",
  auth(),
  requirePermission("storefront.update"),
  validate(v.updateFlashSale),
  asyncHandler(ctrl.updateFlashSale),
);

router.post(
  "/settings/flash-sale/launch",
  auth(),
  requirePermission("storefront.update"),
  requirePermission("discounts.create"),
  validate(v.launchFlashSale),
  asyncHandler(ctrl.launchFlashSale),
);

module.exports = router;
