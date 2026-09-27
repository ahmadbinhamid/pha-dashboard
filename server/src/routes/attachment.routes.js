// routes/attachment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, tenantMember } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const { uploadMultiple } = require("../middlewares/upload");
const ctrl = require("../controllers/attachment.controller");

router.use(auth());

router.post("/", tenantMember, uploadMultiple, asyncHandler(ctrl.upload));
router.get("/", tenantMember, pagination(), asyncHandler(ctrl.list));
router.delete("/:id", tenantMember, asyncHandler(ctrl.remove));

module.exports = router;
