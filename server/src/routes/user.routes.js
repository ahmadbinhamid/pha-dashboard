// routes/user.routes.js

const router = require("express").Router();
const multer = require("multer");
const upload = multer(); // parses multipart/form-data (no files) into req.body

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const V = require("../validators/user.validation");
const ctrl = require("../controllers/user.controller");

// All routes below require authentication
router.use(auth());

// get all users
router.get(
  "/",
  validate(V.listUsers),
  pagination({ defaultLimit: 15, maxLimit: 100 }),
  asyncHandler(ctrl.getUsers)
);

// update current user's profile
router.put("/", upload.none(), validate(V.updateUser), asyncHandler(ctrl.updateUser));

// get current user's profile
router.get("/profile", asyncHandler(ctrl.getProfile));

// delete user (soft)
router.delete("/:id", validate(V.byIdParam), asyncHandler(ctrl.deleteUser));

module.exports = router;
