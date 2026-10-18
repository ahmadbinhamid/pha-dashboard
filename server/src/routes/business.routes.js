// routes/business.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/business.validation");
const ctrl = require("../controllers/business.controller");

// Businesses only exist to group customers, so customer access governs them.
router.use(auth());

router.get("/", requirePermission("customers.view"), pagination(), validate(v.listBusinesses), asyncHandler(ctrl.getBusinesses));
// Before "/:id", which would otherwise read "options" as a business id.
router.get("/options", requirePermission("customers.view"), asyncHandler(ctrl.getBusinessOptions));
router.get("/:id", requirePermission("customers.view"), validate(v.byIdParam), asyncHandler(ctrl.getBusiness));
router.post("/", requirePermission("customers.create"), validate(v.createBusiness), asyncHandler(ctrl.createBusiness));
router.put("/:id", requirePermission("customers.update"), validate({ ...v.byIdParam, ...v.updateBusiness }), asyncHandler(ctrl.updateBusiness));
router.delete("/:id", requirePermission("customers.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteBusiness));

module.exports = router;
