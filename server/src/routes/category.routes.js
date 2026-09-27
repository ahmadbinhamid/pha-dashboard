// routes/category.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/category.validation");
const ctrl = require("../controllers/category.controller");

// Public: tenant from a staff JWT if sent, else X-Tenant-Slug.
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

// Protected routes: any member of the organisation
router.post(
  "/",
  auth(),
  requirePermission("categories.create"),
  validate(v.createCategory),
  asyncHandler(ctrl.createCategory),
);
router.put(
  "/:id",
  auth(),
  requirePermission("categories.update"),
  validate({ ...v.byIdParam, ...v.updateCategory }),
  asyncHandler(ctrl.updateCategory),
);
router.delete(
  "/:id",
  auth(),
  requirePermission("categories.delete"),
  validate(v.byIdParam),
  asyncHandler(ctrl.deleteCategory),
);

module.exports = router;
