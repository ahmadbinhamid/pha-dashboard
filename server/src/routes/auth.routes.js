// routes/auth.routes.js

const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, superadmin } = require("../middlewares/auth");
const V = require("../validators/auth.validation");
const ctrl = require("../controllers/auth.controller");

// register
router.post(
  "/register",
  upload.none(),
  validate(V.register),
  asyncHandler(ctrl.register)
);

// login
router.post(
  "/login",
  upload.none(),
  validate(V.login),
  asyncHandler(ctrl.login)
);

// verify OTP for login
router.post(
  "/verify-otp",
  upload.none(),
  validate(V.verifyOTP),
  asyncHandler(ctrl.verifyOTP)
);

// resend OTP for login
router.post(
  "/resend-otp",
  upload.none(),
  validate(V.resendOTP),
  asyncHandler(ctrl.resendOTP)
);

// forgot password
router.post(
  "/forgot-password",
  upload.none(),
  validate(V.forgotPassword),
  asyncHandler(ctrl.forgotPassword)
);

// reset password
router.post(
  "/reset-password",
  upload.none(),
  validate(V.resetPassword),
  asyncHandler(ctrl.resetPassword)
);

// auth middleware(for protected routes)
router.use(auth());

// verify account (initial verification) - Superadmin only
router.post(
  "/verify-account",
  upload.none(),
  superadmin,
  validate(V.verifyAccount),
  asyncHandler(ctrl.verifyAccount)
);

// Change password (self) — authenticated user
router.post(
  "/change-password",
  upload.none(),
  validate(V.changePassword),
  asyncHandler(ctrl.changePassword)
);

module.exports = router;
