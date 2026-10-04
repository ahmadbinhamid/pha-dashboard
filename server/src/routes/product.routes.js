// routes/product.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/product.validation");
const ctrl = require("../controllers/product.controller");
const { upload } = require("../middlewares/upload");

const formFields = upload.none();

// Staff JWT sets the tenant when present; else X-Tenant-Slug does.
router.get(
  "/",
  auth(false),
  resolveGuestTenant(), // NOTE: no IP limiter; storefront SSR fetches from one IP.
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
// Must precede "/:slug", which would treat "stats" as a product slug.
router.get("/stats", auth(), requirePermission("products.view"), asyncHandler(ctrl.getProductStats));
router.get(
  "/:slug",
  auth(false),
  resolveGuestTenant(),
  validate(v.bySlugParam),
  asyncHandler(ctrl.getProduct),
);

router.post("/", auth(), requirePermission("products.create"), formFields, validate(v.createProduct), asyncHandler(ctrl.createProduct));
router.put(
  "/:id",
  auth(), requirePermission("products.update"),
  formFields,
  validate(v.byIdParam),
  asyncHandler(ctrl.updateProduct),
);
router.delete(
  "/:id",
  auth(), requirePermission("products.delete"),
  validate(v.byIdParam),
  asyncHandler(ctrl.deleteProduct),
);
router.post(
  "/:id/duplicate",
  auth(), requirePermission("products.create"),
  validate(v.byIdParam),
  asyncHandler(ctrl.duplicateProduct),
);
router.get(
  "/:id/variants",
  auth(), requirePermission("products.view"),
  validate(v.byIdParam),
  asyncHandler(ctrl.getVariants),
);
router.put(
  "/:id/variants/:variantId",
  auth(), requirePermission("products.update"),
  formFields,
  validate(v.byVariantParam),
  asyncHandler(ctrl.updateVariant),
);
router.post(
  "/:id/notes",
  auth(), requirePermission("products.update"),
  validate(v.addProductNote),
  asyncHandler(ctrl.addProductNote),
);
router.post(
  "/:id/send-email",
  auth(), requirePermission("products.view"),
  validate(v.sendProductEmail),
  asyncHandler(ctrl.sendProductEmail),
);

module.exports = router;
