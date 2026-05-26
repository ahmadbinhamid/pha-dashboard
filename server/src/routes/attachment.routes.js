// routes/attachment.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const { uploadMultiple } = require("../middlewares/upload");
const ctrl = require("../controllers/attachment.controller");

router.use(auth());

router.post("/", uploadMultiple, asyncHandler(ctrl.upload));
router.get("/", pagination(), asyncHandler(ctrl.list));
router.delete("/:id", asyncHandler(ctrl.remove));

module.exports = router;
