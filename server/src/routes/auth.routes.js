// routes/auth.routes.js

const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, superadmin } = require("../middlewares/auth");
const {
  loginAccountLimiter,
  loginNetworkLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  forgotPasswordLimiter,
  passwordResetLimiter,
  signupLimiter,
} = require("../middlewares/rateLimit");
const V = require("../validators/auth.validation");
const ctrl = require("../controllers/auth.controller");

// register (join an EXISTING tenant as staff)
router.post(
  "/register",
  signupLimiter,
  upload.none(),
  validate(V.register),
  asyncHandler(ctrl.register)
);

// self-service signup — creates a BRAND NEW tenant + its first (admin) user
router.post(
  "/register-tenant",
  signupLimiter,
  upload.none(),
  validate(V.registerTenant),
  asyncHandler(ctrl.registerTenant)
);

// login
router.post(
  "/login",
  upload.none(),
  // NOTE: after upload.none() so a multipart body's email is parsed in time.
  loginNetworkLimiter,
  loginAccountLimiter,
  validate(V.login),
  asyncHandler(ctrl.login)
);

// Completes login when one email belongs to staff in several tenants.
router.post(
  "/select-organization",
  loginNetworkLimiter,
  upload.none(),
  validate(V.selectOrganization),
  asyncHandler(ctrl.selectOrganization)
);

// verify OTP for login
router.post(
  "/verify-otp",
  upload.none(),
  otpVerifyLimiter,
  validate(V.verifyOTP),
  asyncHandler(ctrl.verifyOTP)
);

// resend OTP for login
router.post(
  "/resend-otp",
  upload.none(),
  otpResendLimiter,
  validate(V.resendOTP),
  asyncHandler(ctrl.resendOTP)
);

// forgot password
router.post(
  "/forgot-password",
  upload.none(),
  forgotPasswordLimiter,
  validate(V.forgotPassword),
  asyncHandler(ctrl.forgotPassword)
);

// reset password
router.post(
  "/reset-password",
  passwordResetLimiter,
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
