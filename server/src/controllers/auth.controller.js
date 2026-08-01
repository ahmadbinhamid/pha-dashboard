const {
  findUserByEmail,
  createUser,
  findUserByEmailWithPassword,
  findUserByEmailWithOtp,
  findUserByIdWithPassword,
  findUserByResetToken,
  saveUser,
} = require("../services/user.service");
const { comparePassword } = require("../utils/auth/crypto");
const { signJwt } = require("../utils/auth/jwt");
const {
  generateOTP,
  generateOTPExpiry,
  isOTPExpired,
  hashOTP,
} = require("../utils/auth/otp");
const {
  generateResetToken,
  generateResetTokenExpiry,
  isResetTokenExpired,
  isValidResetTokenFormat,
  createResetUrl,
  hashResetToken,
  verifyResetToken,
} = require("../utils/auth/passwordReset");
const {
  success,
  badRequest,
  unauthorized,
  systemfailure,
  requestConflict,
} = require("../utils/http/response");
const {
  sendOTP,
  accountVerified,
  sendPasswordReset,
} = require("../services/email/email.service");
const { toPublicUser, fullName } = require("../utils/user");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");
const Tenant = require("../models/Tenant");
const config = require("../config");

exports.register = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, tenant_slug } = req.body || {};

    const tenant = await Tenant.findOne({ slug: tenant_slug });
    if (!tenant) return badRequest(res, "Unknown tenant");

    const existing = await findUserByEmail(email, tenant._id);
    if (existing)
      return requestConflict(res, "User with this email already exists");

    const user = await createUser({
      tenant_id: tenant._id,
      first_name,
      last_name,
      email,
      password,
      role: role || USER_ROLE.USER,
      status: USER_STATUS.INACTIVE,
      verified_at: null,
    });

    return success(
      res,
      toPublicUser(user),
      "Registration successful. Your account requires admin verification before you can log in.",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const user = await findUserByEmailWithPassword(email);
    if (!user) return unauthorized(res, "Invalid email or password");

    const ok = await comparePassword(password, user.password);
    if (!ok) return unauthorized(res, "Invalid email or password");

    if (user.status !== USER_STATUS.ACTIVE) {
      return unauthorized(
        res,
        "Account not verified. Please contact your administrator.",
      );
    }

    // OTP DISABLED — issue JWT directly on login
    // const otp = generateOTP();
    // user.otp = hashOTP(otp);
    // user.otp_expiry = generateOTPExpiry();
    // await user.save();
    // await sendOTP({ to: user.email, name: fullName(user), otp });
    // return success(res, { email: user.email }, "OTP sent to your email. Please verify to complete login.");

    const token = signJwt({
      sub: user._id.toString(),
      role: user.role,
      tenant_id: user.tenant_id?.toString() || null,
      email: user.email,
      name: fullName(user),
    });

    return success(res, toPublicUser(user), "Login successful", token);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    const user = await findUserByEmailWithOtp(email);
    if (!user) return unauthorized(res, "Invalid email");

    if (!user.otp) {
      return unauthorized(res, "No OTP found. Please request a new OTP.");
    }

    if (isOTPExpired(user.otp_expiry)) {
      user.otp = null;
      user.otp_expiry = null;
      await saveUser(user);
      return unauthorized(res, "OTP has expired. Please request a new OTP.");
    }

    if (hashOTP(otp) !== user.otp) {
      return unauthorized(res, "Invalid OTP");
    }

    user.otp = null;
    user.otp_expiry = null;
    await saveUser(user);

    const token = signJwt({
      sub: user._id.toString(),
      role: user.role,
      tenant_id: user.tenant_id?.toString() || null,
      email: user.email,
      name: fullName(user),
    });

    return success(res, toPublicUser(user), "Login successful", token);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.verifyAccount = async (req, res) => {
  try {
    const { email, status } = req.body || {};

    // Scoped to the calling superadmin's own tenant — verifying a
    // self-registered user in another tenant is not this endpoint's job.
    const user = await findUserByEmail(email, req.tenantId);
    if (!user) return unauthorized(res, "Invalid email");

    user.status = status;
    user.verified_at = status === USER_STATUS.ACTIVE ? new Date() : null;
    await saveUser(user);

    if (status === USER_STATUS.ACTIVE) {
      await accountVerified({
        to: user.email,
        name: fullName(user),
        verifiedDate: user.verified_at.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    const msg =
      status === USER_STATUS.ACTIVE
        ? "Account verified successfully"
        : "Account marked as not verified";
    return success(res, toPublicUser(user), msg);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    const user = await findUserByEmail(email);
    if (!user) {
      return success(
        res,
        null,
        "If an account with that email exists, a password reset link has been sent.",
      );
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return badRequest(
        res,
        "Account not verified. Please contact your administrator.",
      );
    }

    const resetToken = generateResetToken();
    user.password_reset_token = hashResetToken(resetToken);
    user.password_reset_expiry = generateResetTokenExpiry();
    await saveUser(user);

    await sendPasswordReset({
      to: user.email,
      name: fullName(user),
      resetUrl: createResetUrl(resetToken),
      expiryMinutes: config.passwordReset.expiryMinutes,
    });

    return success(
      res,
      null,
      "If an account with that email exists, a password reset link has been sent.",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body || {};

    if (!isValidResetTokenFormat(token)) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    const user = await findUserByResetToken(hashResetToken(token));

    if (!user) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    if (isResetTokenExpired(user.password_reset_expiry)) {
      user.password_reset_token = null;
      user.password_reset_expiry = null;
      await saveUser(user);
      return badRequest(
        res,
        "Reset token has expired. Please request a new password reset.",
      );
    }

    if (!verifyResetToken(token, user.password_reset_token)) {
      return badRequest(res, "Invalid or expired reset token.");
    }

    user.password = new_password;
    user.password_reset_token = null;
    user.password_reset_expiry = null;
    await saveUser(user);

    return success(
      res,
      null,
      "Password reset successfully. You can now log in with your new password.",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    const userId = req.user?._id;

    if (!userId) return unauthorized(res, "Unauthorized");

    const user = await findUserByIdWithPassword(userId);
    if (!user) return unauthorized(res, "Unauthorized");

    const ok = await comparePassword(current_password, user.password);
    if (!ok) return unauthorized(res, "Current password is incorrect");

    user.password = new_password;
    await saveUser(user);

    return success(res, null, "Password changed");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body || {};

    const user = await findUserByEmail(email);
    if (!user) return unauthorized(res, "Invalid email");

    if (user.status !== USER_STATUS.ACTIVE) {
      return unauthorized(
        res,
        "Account not verified. Please contact your administrator.",
      );
    }

    const otp = generateOTP();
    user.otp = hashOTP(otp);
    user.otp_expiry = generateOTPExpiry();
    await saveUser(user);

    await sendOTP({
      to: user.email,
      name: fullName(user),
      otp,
    });

    return success(res, { email: user.email }, "OTP resent to your email.");
  } catch (err) {
    return systemfailure(res, err);
  }
};
