// routes/role.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, requirePermission } = require("../middlewares/auth");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/role.controller");

router.use(auth());

// A static list of capability names, not tenant data — readable by anyone who can see roles.
router.get("/permissions", requirePermission("roles.view"), asyncHandler(ctrl.listPermissions));

router.get("/", requirePermission("roles.view"), asyncHandler(ctrl.listRoles));
router.get("/:id", requirePermission("roles.view"), validate(V.roleIdParam), asyncHandler(ctrl.getRole));
router.post("/", requirePermission("roles.create"), validate(V.createRole), asyncHandler(ctrl.createRole));
router.put("/:id", requirePermission("roles.update"), validate(V.updateRole), asyncHandler(ctrl.updateRole));
router.delete("/:id", requirePermission("roles.delete"), validate(V.roleIdParam), asyncHandler(ctrl.deleteRole));

module.exports = router;
