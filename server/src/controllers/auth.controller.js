// controllers/auth.controller.js

const User = require("../models/User");
const { comparePassword } = require("../utils/crypto");
const { signJwt } = require("../utils/jwt");
const {
  sendOTP,
  accountVerified,
  sendPasswordReset,
} = require("../services/email/email.service");
const {
  generateOTP,
  generateOTPExpiry,
  isOTPExpired,
  hashOTP,
} = require("../utils/otp");
const {
  generateResetToken,
  generateResetTokenExpiry,
  isResetTokenExpired,
  isValidResetTokenFormat,
  createResetUrl,
  hashResetToken,
  verifyResetToken,
} = require("../utils/passwordReset");
const config = require("../config");
const {
  success,
  badRequest,
  unauthorized,
  systemfailure,
  requestConflict,
} = require("../utils/response");

// register
exports.register = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role } = req.body || {};

    // Check if user with this email already exists
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return requestConflict(res, "User with this email already exists");
    }

    // Create new user
    const user = new User({
      first_name,
      last_name,
      email,
      password,
      role: role || "user",
      status: 0,
      verified_at: null,
    });

    await user.save();

    // Return user data without password
    const userData = user.toObject();
    delete userData.password;

    return success(
      res,
      userData,
      "Registration successful. Your account requires admin verification before you can log in."
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

// login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // password has select:false in schema -> include it explicitly
    const user = await User.findOne({ email }).select("+password");
    if (!user) return unauthorized(res, "Invalid email or password");

    const ok = await comparePassword(password, user.password);
    if (!ok) return unauthorized(res, "Invalid email or password");

    // Check if user is verified
    if (user.status != 1) {
      return unauthorized(
        res,
        "Account not verified. Please verify your account first."
      );
    }

    // Generate OTP for login verification
    const otp = generateOTP();
    const otpExpiry = generateOTPExpiry();

    user.otp = hashOTP(otp);
    user.otp_expiry = otpExpiry;
    await user.save();

    const fullName = `${user.first_name} ${user.last_name}`.trim();
    await sendOTP({ to: user.email, name: fullName, otp });

    return success(
      res,
      { email: user.email },
      "OTP sent to your email. Please verify to complete login."
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

// verify OTP for login
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    const user = await User.findOne({ email }).select("+otp +otp_expiry");
    if (!user) return unauthorized(res, "Invalid email");

    if (!user.otp) {
      return unauthorized(res, "No OTP found. Please request a new OTP.");
    }

    if (isOTPExpired(user.otp_expiry)) {
      user.otp = null;
      user.otp_expiry = null;
      await user.save();
      return unauthorized(res, "OTP has expired. Please request a new OTP.");
    }

    if (hashOTP(otp) !== user.otp) {
      return unauthorized(res, "Invalid OTP");
    }

    user.otp = null;
    user.otp_expiry = null;
    await user.save();

    const fullName = `${user.first_name} ${user.last_name}`.trim();

    const token = signJwt({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      name: fullName,
    });
    const out = user.toObject();
    delete out.password;

    return success(res, out, "Login successful", token);
  } catch (err) {
    return systemfailure(res, err);
  }
};

// verify account (for initial account verification) - Superadmin only
exports.verifyAccount = async (req, res) => {
  try {
    const { email, status } = req.body || {};

    const user = await User.findOne({ email });
    if (!user) return unauthorized(res, "Invalid email");

    // Update fields
    user.status = status;
    user.verified_at = status === 1 ? new Date() : null;

    await user.save();

    // Send notification email
    const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

    if (status === 1) {
      await accountVerified({
        to: user.email,
        name: fullName,
        verifiedDate: user.verified_at.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    const out = user.toObject();
    delete out.password;

    const msg =
      status === 1
        ? "Account verified successfully"
        : "Account marked as not verified";
    return success(res, out, msg);
  } catch (err) {
    return systemfailure(res, err);
  }
};
// forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      return success(
        res,
        null,
        "If an account with that email exists, a password reset link has been sent."
      );
    }

    // Check if user is verified
    if (user.status != 1) {
      return badRequest(
        res,
        "Account not verified. Please verify your account first."
      );
    }

    // Generate reset token and expiry
    const resetToken = generateResetToken();
    const tokenExpiry = generateResetTokenExpiry();
    const hashedToken = hashResetToken(resetToken);

    // Save reset token to user (include password_reset_token explicitly)
    user.password_reset_token = hashedToken;
    user.password_reset_expiry = tokenExpiry;
    await user.save();

    // Create reset URL
    const resetUrl = createResetUrl(resetToken);

    // Send password reset email
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    await sendPasswordReset({
      to: user.email,
      name: fullName,
      resetUrl: resetUrl,
      expiryMinutes: config.passwordReset.expiryMinutes,
    });

    return success(
      res,
      null,
      "If an account with that email exists, a password reset link has been sent."
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

// reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body || {};

    // Validate token format
    if (!isValidResetTokenFormat(token)) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    // Find user with reset token (include password_reset_token explicitly)
    const user = await User.findOne({
      password_reset_token: hashResetToken(token),
    }).select("+password_reset_token");

    if (!user) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    // Check if token has expired
    if (isResetTokenExpired(user.password_reset_expiry)) {
      // Clear expired token
      user.password_reset_token = null;
      user.password_reset_expiry = null;
      await user.save();
      return badRequest(
        res,
        "Reset token has expired. Please request a new password reset."
      );
    }

    // Verify token matches
    if (!verifyResetToken(token, user.password_reset_token)) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    // Update password and clear reset token
    user.password = new_password;
    user.password_reset_token = null;
    user.password_reset_expiry = null;
    await user.save(); // This will trigger password hashing via pre('save') hook

    return success(
      res,
      null,
      "Password reset successfully. You can now login with your new password."
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

// POST /auth/change-password (self)
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    const userId = req.user?._id; // set by auth()

    if (!userId) return unauthorized(res, "Unauthorized");

    // need the hash -> include password explicitly
    const user = await User.findById(userId).select("+password");
    if (!user) return unauthorized(res, "Unauthorized");

    const ok = await comparePassword(current_password, user.password);
    if (!ok) return unauthorized(res, "Current password is incorrect");

    // <<< IMPORTANT: use save() to trigger pre('save') hashing
    user.password = new_password;
    await user.save(); // will hash via your pre('save') hook

    return success(res, null, "Password changed");
  } catch (err) {
    return systemfailure(res, err);
  }
};

// resend OTP for login
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body || {};

    const user = await User.findOne({ email });
    if (!user) return unauthorized(res, "Invalid email");

    // Only allow resend for verified accounts (login OTP flow)
    if (user.status != 1) {
      return unauthorized(
        res,
        "Account not verified. Please verify your account first."
      );
    }

    const otp = generateOTP();
    const otpExpiry = generateOTPExpiry();

    user.otp = hashOTP(otp);
    user.otp_expiry = otpExpiry;
    await user.save();

    const fullName = `${user.first_name} ${user.last_name}`.trim();
    await sendOTP({ to: user.email, name: fullName, otp });

    return success(
      res,
      { email: user.email },
      "OTP resent to your email. Please verify to complete login."
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};
