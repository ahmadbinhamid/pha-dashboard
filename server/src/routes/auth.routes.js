// routes/auth.routes.js

const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, superadmin } = require("../middlewares/auth");
const { loginLimiter } = require("../middlewares/rateLimit");
const V = require("../validators/auth.validation");
const ctrl = require("../controllers/auth.controller");

// register (join an EXISTING tenant as staff)
router.post(
  "/register",
  loginLimiter,
  upload.none(),
  validate(V.register),
  asyncHandler(ctrl.register)
);

// self-service signup — creates a BRAND NEW tenant + its first (admin) user
router.post(
  "/register-tenant",
  loginLimiter,
  upload.none(),
  validate(V.registerTenant),
  asyncHandler(ctrl.registerTenant)
);

// login
router.post(
  "/login",
  loginLimiter,
  upload.none(),
  validate(V.login),
  asyncHandler(ctrl.login)
);

// completes login when /login reports requires_org_selection (an email
// shared by more than one tenant's staff account)
router.post(
  "/select-organization",
  loginLimiter,
  upload.none(),
  validate(V.selectOrganization),
  asyncHandler(ctrl.selectOrganization)
);

// verify OTP for login
router.post(
  "/verify-otp",
  loginLimiter,
  upload.none(),
  validate(V.verifyOTP),
  asyncHandler(ctrl.verifyOTP)
);

// resend OTP for login
router.post(
  "/resend-otp",
  loginLimiter,
  upload.none(),
  validate(V.resendOTP),
  asyncHandler(ctrl.resendOTP)
);

// forgot password
router.post(
  "/forgot-password",
  loginLimiter,
  upload.none(),
  validate(V.forgotPassword),
  asyncHandler(ctrl.forgotPassword)
);

// reset password
router.post(
  "/reset-password",
  loginLimiter,
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
