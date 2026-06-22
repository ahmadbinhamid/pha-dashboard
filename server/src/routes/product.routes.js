// routes/product.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/product.validation");
const ctrl = require("../controllers/product.controller");
const { upload } = require("../middlewares/upload");

const formFields = upload.none();

router.get(
  "/",
  pagination(),
  validate(v.listProducts),
  asyncHandler(ctrl.getProducts),
);
router.get("/:slug", validate(v.bySlugParam), asyncHandler(ctrl.getProduct));

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
router.post(
  "/:id/sync-ebay",
  auth(),
  validate(v.byIdParam),
  asyncHandler(ctrl.syncToEbay),
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

module.exports = router;
