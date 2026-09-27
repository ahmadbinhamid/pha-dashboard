// routes/categoryMapping.routes.js
// Category mapping settings: members of the organisation.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/categoryMapping.validation");
const ctrl = require("../controllers/categoryMapping.controller");

router.get("/", auth(), asyncHandler(ctrl.getOverview));
router.get("/products/:productId", auth(), validate(v.productParams), asyncHandler(ctrl.getForProduct));
router.put("/:categoryId/:platform", auth(), tenantMember, validate(v.upsertMapping), asyncHandler(ctrl.upsertMapping));
router.delete("/:categoryId/:platform", auth(), tenantMember, validate(v.mappingParams), asyncHandler(ctrl.deleteMapping));

module.exports = router;
