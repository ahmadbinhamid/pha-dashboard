// routes/domain.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/domain.validation");
const ctrl = require("../controllers/domain.controller");

router.get("/", auth(), admin, asyncHandler(ctrl.getDomains));
router.post("/", auth(), admin, validate(v.createDomain), asyncHandler(ctrl.createDomain));
router.delete("/:id", auth(), admin, validate(v.domainIdParam), asyncHandler(ctrl.deleteDomain));
router.put("/:id/default", auth(), admin, validate(v.domainIdParam), asyncHandler(ctrl.setDefaultDomain));
router.post("/:id/verify", auth(), admin, validate(v.domainIdParam), asyncHandler(ctrl.verifyDomain));

module.exports = router;
