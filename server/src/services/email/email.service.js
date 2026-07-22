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

/**
 * Notify the sales inbox of a new newsletter subscriber
 */
async function sendNewsletterSignupNotification({ subscriberEmail }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to: config.smtp.salesEmail,
    subject: `[Newsletter] New subscriber — ${subscriberEmail}`,
    template: "newsletterNotification",
    variables: {
      subscriber_email: subscriberEmail,
    },
  });
}

/**
 * Notify a customer that their DELIVERY order has shipped, with tracking
 * details and the tax invoice attached as a PDF (base64-encoded — Bull job
 * payloads are JSON over Redis, so a raw Buffer wouldn't round-trip to the
 * worker intact).
 */
async function sendOrderShipped({ to, name, orderNumber, trackingNumber, carrierName, pdfBase64, pdfFilename }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Your order ${orderNumber} has shipped — ${config.emailBrand.appName}`,
    template: "orderShipped",
    variables: {
      name,
      order_number: orderNumber,
      tracking_number: trackingNumber,
      carrier_name: carrierName,
    },
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBase64,
        encoding: "base64",
      },
    ],
  });
}

/**
 * Notify a customer that their PICKUP order is ready for collection, with
 * the tax invoice attached as a PDF (base64-encoded — Bull job payloads are
 * JSON over Redis, so a raw Buffer wouldn't round-trip to the worker intact).
 */
async function sendOrderReadyForPickup({ to, name, orderNumber, pdfBase64, pdfFilename }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Your order ${orderNumber} is ready for pickup — ${config.emailBrand.appName}`,
    template: "orderReadyForPickup",
    variables: {
      name,
      order_number: orderNumber,
    },
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBase64,
        encoding: "base64",
      },
    ],
  });
}

/**
 * Notify a customer their storefront order was placed and paid — sent
 * automatically once payment succeeds (see stripe.webhook.service.js). No
 * invoice attached here; that's sent manually later via the admin's
 * "Send Email" action (sendOrderShipped / sendOrderReadyForPickup above).
 */
async function sendOrderConfirmation({ to, name, orderNumber, viewOrderUrl }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Order Confirmed — ${orderNumber} — ${config.emailBrand.appName}`,
    template: "orderConfirmation",
    variables: {
      name,
      order_number: orderNumber,
      view_order_url: viewOrderUrl,
    },
  });
}

module.exports = {
  sendOTP,
  accountVerified,
  sendPasswordReset,
  sendInquiryNotification,
  sendNewsletterSignupNotification,
  sendOrderShipped,
  sendOrderReadyForPickup,
  sendOrderConfirmation,
};
