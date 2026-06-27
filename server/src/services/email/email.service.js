const { enqueueEmailJob } = require("../../queues/email.queue");
const config = require("../../config");

const defaultFrom = () =>
  `"${config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`;

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

/**
 * Send storefront inquiry notification to sales inbox
 */
async function sendInquiryNotification({ customerName, customerEmail, customerPhone, subject, message }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to: config.smtp.salesEmail,
    subject: `[Inquiry] ${subject} — ${customerName}`,
    template: "inquiryNotification",
    variables: {
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      subject,
      message,
      app_name: config.emailBrand.appName,
    },
  });
}

module.exports = { sendOTP, accountVerified, sendPasswordReset, sendInquiryNotification };
