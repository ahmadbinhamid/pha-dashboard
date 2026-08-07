const {
  findUserByEmail,
  createUser,
  findUserByEmailWithPassword,
  findAllUsersByEmailWithPassword,
  findAllUsersByEmail,
  findUserAmongIdsForTenant,
  findUserByEmailWithOtp,
  findUserByIdWithPassword,
  findUserByResetToken,
  saveUser,
} = require("../services/user.service");
const { comparePassword } = require("../utils/auth/crypto");
const { signJwt, verifyJwt } = require("../utils/auth/jwt");
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
const tenantService = require("../services/tenant.service");
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

// Self-service signup — creates a brand-new tenant plus its first (admin)
// user, unlike register() above which joins an existing tenant. The new
// user is active immediately (no admin exists yet on a brand-new tenant to
// approve them) and logged in right away, same response shape as login().
exports.registerTenant = async (req, res) => {
  try {
    const { company_name, first_name, last_name, email, password } = req.body || {};

    const { tenant, user } = await tenantService.registerTenantWithAdmin({
      company_name,
      first_name,
      last_name,
      email,
      password,
    });

    const token = signJwt({
      sub: user._id.toString(),
      role: user.role,
      tenant_id: tenant._id.toString(),
      email: user.email,
      name: fullName(user),
    });

    return success(res, toPublicUser(user), "Account created", token);
  } catch (err) {
    if (err.code === 11000) return requestConflict(res, "That email or company name is already in use");
    if (err.status) return badRequest(res, err.message);
    return systemfailure(res, err);
  }
};

function issueLoginToken(user) {
  return signJwt({
    sub: user._id.toString(),
    role: user.role,
    tenant_id: user.tenant_id?.toString() || null,
    email: user.email,
    name: fullName(user),
  });
}

// email is unique per-tenant, not globally (User.js's compound index
// deliberately allows the same person to hold a separate account under more
// than one tenant — e.g. staff at more than one of our clients). Previously
// this looked up a single `User.findOne({email})`, which — if the same email
// existed under two tenants — resolved to whichever one Mongo happened to
// return first, risking authenticating someone into the WRONG tenant's
// dashboard. Found in a tenant-isolation audit (Aug 2026), not live-reported.
//
// Fix: verify the password against EVERY account sharing this email. Exactly
// one match (the overwhelming common case) logs in exactly as before, no
// behavior change. More than one match means this identity genuinely holds
// multiple organization memberships — industry-standard handling
// (Slack/Notion/Linear-style) is to authenticate the PERSON here, then let
// them pick which organization to enter via exports.selectOrganization,
// rather than guessing one for them.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const candidates = await findAllUsersByEmailWithPassword(email);
    if (!candidates.length) return unauthorized(res, "Invalid email or password");

    const checks = await Promise.all(
      candidates.map(async (user) => ({ user, ok: await comparePassword(password, user.password) })),
    );
    const matched = checks.filter((c) => c.ok).map((c) => c.user);
    if (!matched.length) return unauthorized(res, "Invalid email or password");

    const active = matched.filter((user) => user.status === USER_STATUS.ACTIVE);
    if (!active.length) {
      return unauthorized(
        res,
        "Account not verified. Please contact your administrator.",
      );
    }

    if (active.length === 1) {
      const user = active[0];
      return success(res, toPublicUser(user), "Login successful", issueLoginToken(user));
    }

    const tenants = await tenantService.findTenantsByIds(active.map((u) => u.tenant_id));
    const tenantById = new Map(tenants.map((t) => [t._id.toString(), t]));

    // Short-lived — carries no access, just proof that THIS email+password
    // pair already cleared credential checks for exactly this set of
    // accounts. selectOrganization only trusts a tenant_id choice that
    // appears in user_ids below, so it can't be used to pick an account
    // whose password was never actually verified above.
    const pendingToken = signJwt(
      { purpose: "org_selection", email, user_ids: active.map((u) => u._id.toString()) },
      { expiresIn: "10m" },
    );

    return success(
      res,
      {
        requires_org_selection: true,
        pending_token: pendingToken,
        organizations: active.map((u) => ({
          tenant_id: u.tenant_id.toString(),
          tenant_name: tenantById.get(u.tenant_id.toString())?.name ?? null,
          tenant_slug: tenantById.get(u.tenant_id.toString())?.slug ?? null,
        })),
      },
      "Multiple organizations found for this account — select one to continue.",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Completes login for a multi-organization account — see exports.login.
// Trusts tenant_id only if it belongs to the pending_token's user_ids set,
// which was itself only populated for accounts whose password already
// verified during login(); this endpoint never re-checks a password.
exports.selectOrganization = async (req, res) => {
  try {
    const { pending_token, tenant_id } = req.body || {};

    let decoded;
    try {
      decoded = verifyJwt(pending_token);
    } catch {
      return unauthorized(res, "Selection expired — please log in again.");
    }
    if (decoded.purpose !== "org_selection") {
      return unauthorized(res, "Invalid selection token.");
    }

    const user = await findUserAmongIdsForTenant(decoded.user_ids, tenant_id);
    if (!user) return unauthorized(res, "That organization is not available for this account.");

    if (user.status !== USER_STATUS.ACTIVE) {
      return unauthorized(
        res,
        "Account not verified. Please contact your administrator.",
      );
    }

    return success(res, toPublicUser(user), "Login successful", issueLoginToken(user));
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

// Same email-not-globally-unique reasoning as login() — sends a SEPARATE
// reset link per matching account instead of guessing which one tenant the
// person meant, since (unlike login) there's no password yet to narrow
// candidates down to one. Whoever owns the inbox ends up with one email per
// organization membership and resets whichever they meant.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    const genericMessage = "If an account with that email exists, a password reset link has been sent.";

    const users = await findAllUsersByEmail(email);
    const active = users.filter((user) => user.status === USER_STATUS.ACTIVE);
    if (!active.length) {
      return success(res, null, genericMessage);
    }

    await Promise.all(
      active.map(async (user) => {
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
      }),
    );

    return success(res, null, genericMessage);
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
