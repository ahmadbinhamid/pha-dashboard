// routes/product.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/product.validation");
const ctrl = require("../controllers/product.controller");
const { upload } = require("../middlewares/upload");

const formFields = upload.none();

// auth(false) resolves req.tenant from a staff JWT when present (admin
// dashboard browsing); resolveGuestTenant() fills in from X-Tenant-Slug
// otherwise (public storefront browsing).
router.get(
  "/",
  auth(false),
  resolveGuestTenant(),
  pagination(),
  validate(v.listProducts),
  asyncHandler(ctrl.getProducts),
);
router.get(
  "/search/suggest",
  auth(false),
  resolveGuestTenant(),
  validate(v.suggestProducts),
  asyncHandler(ctrl.suggestProducts),
);
router.get(
  "/:slug",
  auth(false),
  resolveGuestTenant(),
  validate(v.bySlugParam),
  asyncHandler(ctrl.getProduct),
);

router.post("/", auth(), formFields, asyncHandler(ctrl.createProduct));
router.put(
  "/:id",
  auth(),
  formFields,
  validate(v.byIdParam),
  asyncHandler(ctrl.updateProduct),
);
router.delete(
  "/:id",
  auth(),
  validate(v.byIdParam),
  asyncHandler(ctrl.deleteProduct),
);
router.post(
  "/:id/duplicate",
  auth(),
  validate(v.byIdParam),
  asyncHandler(ctrl.duplicateProduct),
);
router.get(
  "/:id/variants",
  auth(),
  validate(v.byIdParam),
  asyncHandler(ctrl.getVariants),
);
router.put(
  "/:id/variants/:variantId",
  auth(),
  formFields,
  validate(v.byVariantParam),
  asyncHandler(ctrl.updateVariant),
);
router.post(
  "/:id/notes",
  auth(),
  validate(v.addProductNote),
  asyncHandler(ctrl.addProductNote),
);

module.exports = router;
