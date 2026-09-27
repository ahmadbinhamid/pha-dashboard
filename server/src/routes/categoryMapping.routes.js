// routes/categoryMapping.routes.js
// Category mapping settings: members of the organisation.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/categoryMapping.validation");
const ctrl = require("../controllers/categoryMapping.controller");

router.get("/", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getOverview));
router.get("/products/:productId", auth(), requirePermission("listings.view"), validate(v.productParams), asyncHandler(ctrl.getForProduct));
router.put("/:categoryId/:platform", auth(), requirePermission("integrations.update"), validate(v.upsertMapping), asyncHandler(ctrl.upsertMapping));
router.delete("/:categoryId/:platform", auth(), requirePermission("integrations.update"), validate(v.mappingParams), asyncHandler(ctrl.deleteMapping));

module.exports = router;
