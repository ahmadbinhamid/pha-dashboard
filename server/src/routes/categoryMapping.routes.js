// routes/categoryMapping.routes.js
// Tenant category -> channel category defaults. Reads for any staff user; writes admin-only,
// matching category.routes.js.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/categoryMapping.validation");
const ctrl = require("../controllers/categoryMapping.controller");

router.get("/", auth(), asyncHandler(ctrl.getOverview));
router.get("/products/:productId", auth(), validate(v.productParams), asyncHandler(ctrl.getForProduct));
router.put("/:categoryId/:platform", auth(), admin, validate(v.upsertMapping), asyncHandler(ctrl.upsertMapping));
router.delete("/:categoryId/:platform", auth(), admin, validate(v.mappingParams), asyncHandler(ctrl.deleteMapping));

module.exports = router;
