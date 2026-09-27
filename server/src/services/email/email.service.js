const { enqueueEmailJob } = require("../../queues/email.queue");
const config = require("../../config");

const defaultFrom = () =>
  `"${config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`;

// Name only; the address depends on which SMTP account mailer.js picks.
const tenantFromName = (companyProfile) => companyProfile?.company_name || null;

// The app's --accent (hsl 24 95% 53%); email clients can't read CSS vars.
const EMAIL_PRIMARY_COLOR = "#f97316";

// Platform-branded mail (team invites): header and support are the app's own.
const platformBrandVars = () => ({
  app_name: config.emailBrand.appName,
  support_email: config.emailBrand.supportEmail,
  primary_color: EMAIL_PRIMARY_COLOR,
});

const tenantBrandVars = (companyProfile) => ({
  app_name: companyProfile?.company_name || config.emailBrand.appName,
  support_email: companyProfile?.email || config.emailBrand.supportEmail,
  primary_color: EMAIL_PRIMARY_COLOR,
});

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

async function accountVerified({ to, name, verifiedDate }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Account Verified - ${config.emailBrand.appName}`,
    template: "accountVerified", // must match the .hbs filename exactly
    variables: {
      name,
      verified_date: verifiedDate,
      login_url: `${config.emailBrand.clientUrl}/login`,
    },
  });
}

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

/** `to` is the tenant's own inbox, never a platform-wide address. */
async function sendInquiryNotification({ to, customerName, customerEmail, customerPhone, subject, message }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
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

/** `to` is the tenant's own inbox, never a platform-wide address. */
async function sendNewsletterSignupNotification({ to, subscriberEmail }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `[Newsletter] New subscriber — ${subscriberEmail}`,
    template: "newsletterNotification",
    variables: {
      subscriber_email: subscriberEmail,
    },
  });
}

/** Goes to the platform inbox; a demo request has no tenant to resolve. */
async function sendDemoRequestNotification({ fullName, businessName, phone, workEmail, message }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to: config.smtp.alertsTo,
    subject: `[Demo Request] ${businessName} — ${fullName}`,
    template: "demoRequest",
    variables: {
      full_name: fullName,
      business_name: businessName,
      phone: phone || null,
      work_email: workEmail,
      message: message || null,
    },
  });
}

/** Invoice PDF travels as base64 since Bull payloads are JSON. */
async function sendOrderShipped({ to, name, orderNumber, trackingNumber, carrierName, pdfBase64, pdfFilename, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: "Your Order Has Been Shipped",
    template: "orderShipped",
    variables: {
      name,
      order_number: orderNumber,
      tracking_number: trackingNumber,
      carrier_name: carrierName,
      ...tenantBrandVars(companyProfile),
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

/** Invoice PDF travels as base64 since Bull payloads are JSON. */
async function sendOrderReadyForPickup({ to, name, orderNumber, pdfBase64, pdfFilename, pickupLocation = {}, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: "Your Order Is Ready for Pickup",
    template: "orderReadyForPickup",
    variables: {
      name,
      order_number: orderNumber,
      pickup_location_name: pickupLocation.name || "",
      pickup_address: pickupLocation.address || "",
      pickup_country: pickupLocation.country || "",
      trading_hours: pickupLocation.trading_hours || [],
      ...tenantBrandVars(companyProfile),
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

/** No invoice here; it goes with sendOrderShipped. */
async function sendOrderConfirmation({ to, name, orderNumber, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: "Order Confirmation",
    template: "orderConfirmation",
    variables: {
      name,
      order_number: orderNumber,
      ...tenantBrandVars(companyProfile),
    },
  });
}

/** No invoice here; it goes with sendOrderReadyForPickup. */
async function sendOrderReceivedPickup({ to, name, orderNumber, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: "Your Order Has Been Received",
    template: "orderReceivedPickup",
    variables: {
      name,
      order_number: orderNumber,
      ...tenantBrandVars(companyProfile),
    },
  });
}

/** Manual-sale receipt: no shipped/pickup framing, just invoice and balance. */
async function sendManualOrderReceipt({ to, name, orderNumber, amountDue, pdfBase64, pdfFilename, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: `Your Invoice — Order ${orderNumber}`,
    template: "manualOrderReceipt",
    variables: {
      name,
      order_number: orderNumber,
      amount_due: amountDue || null,
      ...tenantBrandVars(companyProfile),
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

/** No invoice PDF; the customer sees it once they pay. */
async function sendPaymentLink({ to, name, orderNumber, amountDue, paymentUrl, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
    to,
    subject: `Complete Your Payment — Order ${orderNumber}`,
    template: "paymentLink",
    variables: {
      name,
      order_number: orderNumber,
      amount_due: amountDue || null,
      payment_url: paymentUrl,
      ...tenantBrandVars(companyProfile),
    },
  });
}

/** Images attach by disk path, relying on the shared uploads volume. */
async function sendProductInfo({ to, name, productTitle, productSku, attachments = [], companyProfile, tenantId }) {
  return enqueueEmailJob(
    {
      fromName: tenantFromName(companyProfile),
      tenantId,
      to,
      subject: `Product Info — ${productTitle}`,
      template: "productInfo",
      variables: {
        name,
        product_title: productTitle,
        product_sku: productSku || null,
        has_images: attachments.length > 0,
        ...tenantBrandVars(companyProfile),
      },
      attachments,
    },
    // Large photos are slow; a timeout can't cancel SMTP, so retries duplicate.
    { timeout: 180000, attempts: 2 },
  );
}

/** Always from the platform mailbox (never BYOK SMTP); items is never empty. */
async function sendLowStockDigest({ to, items, companyProfile, pdfBase64, pdfFilename }) {
  return enqueueEmailJob({
    from: defaultFrom(),
    to,
    subject: `Low Stock Alert — ${items.length} item${items.length === 1 ? "" : "s"} need attention`,
    template: "lowStockDigest",
    variables: {
      items: items.map((i) => ({
        title: i.variant_name ? `${i.title} — ${i.variant_name}` : i.title,
        sku: i.sku || "—",
        stock: i.stock,
      })),
      item_count: items.length,
      item_word: items.length === 1 ? "item" : "items",
      ...tenantBrandVars(companyProfile),
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

/** Legacy join-link invite, sent under the tenant's own brand. */
async function sendTeamInvite({ to, organisationName, inviterName, roleName, inviteUrl, expiresAt }) {
  return enqueueEmailJob({
    // Sent by the platform, not the tenant's own mailbox.
    from: defaultFrom(),
    to,
    subject: `You've been invited to ${organisationName}`,
    template: "teamInvite",
    variables: {
      email: to,
      organisation_name: organisationName,
      inviter_name: inviterName,
      role_name: roleName,
      invite_url: inviteUrl,
      expires_on: expiresAt ? new Date(expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : null,
      ...platformBrandVars(),
    },
  });
}

/** New member: a link to set their first password. */
async function sendTeamSetPassword({ to, firstName, organisationName, inviterName, setPasswordUrl, expiresInHours }) {
  return enqueueEmailJob({
    // Sent by the platform, not the tenant's own mailbox.
    from: defaultFrom(),
    to,
    subject: `Set up your ${organisationName} account`,
    template: "teamSetPassword",
    variables: {
      email: to,
      first_name: firstName,
      organisation_name: organisationName,
      inviter_name: inviterName,
      set_password_url: setPasswordUrl,
      expires_in: `${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}`,
      ...platformBrandVars(),
    },
  });
}

/** Existing account added to another tenant: no password link, just sign in. */
async function sendTeamAdded({ to, firstName, organisationName, inviterName, loginUrl }) {
  return enqueueEmailJob({
    // Sent by the platform, not the tenant's own mailbox.
    from: defaultFrom(),
    to,
    subject: `You've been added to ${organisationName}`,
    template: "teamAdded",
    variables: {
      email: to,
      first_name: firstName,
      organisation_name: organisationName,
      inviter_name: inviterName,
      login_url: loginUrl,
      ...platformBrandVars(),
    },
  });
}

module.exports = {
  sendTeamInvite,
  sendTeamSetPassword,
  sendTeamAdded,
  sendOTP,
  accountVerified,
  sendPasswordReset,
  sendInquiryNotification,
  sendNewsletterSignupNotification,
  sendDemoRequestNotification,
  sendOrderShipped,
  sendOrderReadyForPickup,
  sendOrderConfirmation,
  sendOrderReceivedPickup,
  sendManualOrderReceipt,
  sendPaymentLink,
  sendProductInfo,
  sendLowStockDigest,
};
