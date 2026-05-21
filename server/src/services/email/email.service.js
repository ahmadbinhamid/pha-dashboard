const { enqueueEmailJob } = require("../../queues/email.queue");
const config = require("../../config");

// Utility to build the default FROM string
const defaultFrom = () =>
  `"${config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`;

/**

/**
 * Forgot Password
 */
async function forgotPassword({ to, name, resetURL }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Reset your password - ${config.emailBrand.appName}`,
    template: "forgotPassword",
    variables: {
      name,
      reset_url: resetURL, // signed link you generate elsewhere
    },
  });
}

/**
 * Send OTP for Login Verification
 */
async function sendOTP({ to, name, otp }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Login Verification Code - ${config.emailBrand.appName}`,
    template: "otpVerification",
    variables: {
      name,
      otp,
    },
  });
}

/**
 * Send Account Verification Notification
 */
async function accountVerified({ to, name, verifiedDate }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Account Verified - ${config.emailBrand.appName}`,
    template: "accountVerified", // Make sure this matches the .hbs filename exactly
    variables: {
      name,
      verified_date: verifiedDate,
      login_url: `${config.emailBrand.clientUrl}/login`,
    },
  });
}

/**
 * Send Password Reset Email
 */
async function sendPasswordReset({ to, name, resetUrl, expiryMinutes }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Password Reset Request - ${config.emailBrand.appName}`,
    template: "passwordReset",
    variables: {
      name,
      reset_url: resetUrl,
      expiry_minutes: expiryMinutes,
    },
  });
}

module.exports = {
  forgotPassword,
  sendOTP,
  accountVerified,
  sendPasswordReset,
};
