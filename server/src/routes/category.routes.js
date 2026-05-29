// routes/category.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/category.validation");
const ctrl = require("../controllers/category.controller");

// Public routes
router.get("/", asyncHandler(ctrl.getCategories));
router.get("/:id", validate(v.byIdParam), asyncHandler(ctrl.getCategory));

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
