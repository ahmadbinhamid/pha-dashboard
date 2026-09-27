// routes/role.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, tenantAdmin } = require("../middlewares/auth");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/role.controller");

router.use(auth());

// Static capability names, not tenant data.
router.get("/permissions", tenantAdmin, asyncHandler(ctrl.listPermissions));

router.get("/", tenantAdmin, asyncHandler(ctrl.listRoles));
router.get("/:id", tenantAdmin, validate(V.roleIdParam), asyncHandler(ctrl.getRole));
router.post("/", tenantAdmin, validate(V.createRole), asyncHandler(ctrl.createRole));
router.put("/:id", tenantAdmin, validate(V.updateRole), asyncHandler(ctrl.updateRole));
router.delete("/:id", tenantAdmin, validate(V.roleIdParam), asyncHandler(ctrl.deleteRole));

module.exports = router;
