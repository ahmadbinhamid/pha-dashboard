// routes/category.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/category.validation");
const ctrl = require("../controllers/category.controller");

// Public routes — auth(false) resolves req.tenant from a staff JWT when
// present, resolveGuestTenant() fills in from X-Tenant-Slug otherwise.
router.get(
  "/",
  auth(false),
  resolveGuestTenant(),
  pagination(),
  validate(v.listCategories),
  asyncHandler(ctrl.getCategories),
);
router.get(
  "/:id",
  auth(false),
  resolveGuestTenant(),
  validate(v.byIdParam),
  asyncHandler(ctrl.getCategory),
);

// Protected routes — require admin role
router.post(
  "/",
  auth(),
  admin,
  validate(v.createCategory),
  asyncHandler(ctrl.createCategory),
);
router.put(
  "/:id",
  auth(),
  admin,
  validate({ ...v.byIdParam, ...v.updateCategory }),
  asyncHandler(ctrl.updateCategory),
);
router.delete(
  "/:id",
  auth(),
  admin,
  validate(v.byIdParam),
  asyncHandler(ctrl.deleteCategory),
);

module.exports = router;
