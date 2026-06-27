const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const V = require("../validators/inquiry.validation");
const ctrl = require("../controllers/inquiry.controller");

router.post("/", upload.none(), validate(V.submit), asyncHandler(ctrl.submit));

module.exports = router;
