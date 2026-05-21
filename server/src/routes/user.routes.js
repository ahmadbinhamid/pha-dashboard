// routes/user.routes.js

const router = require("express").Router();
const multer = require("multer");
const upload = multer(); // parses multipart/form-data (no files) into req.body

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, admin } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const V = require("../validators/user.validation");
const ctrl = require("../controllers/user.controller");

// auth middleware(for protected routes)
router.use(auth());

// get all users
router.get(
  "/",
  validate(V.listUsers),
  pagination({ defaultLimit: 20, maxLimit: 100 }),
  asyncHandler(ctrl.getUsers)
);

// current user's profile
router.put("/", upload.none(), auth(), asyncHandler(ctrl.updateUser));

// current user's profile
router.get("/profile", auth(), asyncHandler(ctrl.getProfile));

// delete user
router.delete("/:id", validate(V.byIdParam), asyncHandler(ctrl.deleteUser));

module.exports = router;
