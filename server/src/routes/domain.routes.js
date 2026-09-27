// routes/domain.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/domain.validation");
const ctrl = require("../controllers/domain.controller");

router.get("/", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getDomains));
router.post("/", auth(), requirePermission("integrations.update"), validate(v.createDomain), asyncHandler(ctrl.createDomain));
router.delete("/:id", auth(), requirePermission("integrations.update"), validate(v.domainIdParam), asyncHandler(ctrl.deleteDomain));
router.put("/:id/default", auth(), requirePermission("integrations.update"), validate(v.domainIdParam), asyncHandler(ctrl.setDefaultDomain));
router.post("/:id/verify", auth(), requirePermission("integrations.update"), validate(v.domainIdParam), asyncHandler(ctrl.verifyDomain));

module.exports = router;
