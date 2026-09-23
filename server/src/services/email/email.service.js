const { enqueueEmailJob } = require("../../queues/email.queue");
const config = require("../../config");

const defaultFrom = () =>
  `"${config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`;

// Only the display name can be pre-built here — the address depends on which SMTP account ends
// up sending it, resolved by mailer.js#sendEmail at send time.
const tenantFromName = (companyProfile) => companyProfile?.company_name || null;

const tenantBrandVars = (companyProfile) => ({
  app_name: companyProfile?.company_name || config.emailBrand.appName,
  support_email: companyProfile?.email || config.emailBrand.supportEmail,
});

/** Sends the login verification OTP. */
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

/** Sends the account-verified notification. */
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

/** Sends the password reset email. */
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

/** Notifies a tenant's own inbox of a storefront inquiry; `to` is that tenant's own email, never platform-wide. */
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

/** Notifies a tenant's own inbox of a new newsletter subscriber (same reasoning as sendInquiryNotification). */
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

/** Notifies the platform's own inbox of a "Request a Demo" submission — no tenant to resolve `to` from. */
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

/** Notifies a customer their delivery order shipped, with tracking and the invoice PDF (base64, since Bull payloads are JSON). */
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

/** Notifies a customer their pickup order is ready, with the invoice PDF attached (base64). */
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

/** Notifies a customer their delivery order was placed and paid; no invoice here (see sendOrderShipped). */
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

/** Notifies a customer their pickup order was placed and paid; no invoice here (see sendOrderReadyForPickup). */
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

/** Sends the invoice/receipt for a manual sale — no shipped/pickup framing, just the invoice and any balance due. */
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

/** Sends a customer a link to pay an order online. No invoice PDF; they see it once they pay. */
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

/** Sends a product's title/SKU/images to a recipient the admin picks; images attached by disk path (shared uploads volume). */
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
    // Product photos are several MB through a rate-limited transporter — the default 30s job
    // timeout was too short and, since it can't cancel an in-flight SMTP send, caused duplicate
    // deliveries on retry. Longer timeout + fewer attempts caps the worst case.
    { timeout: 180000, attempts: 2 },
  );
}

/** Sends a tenant's daily low-stock digest, always from the platform mailbox (never BYOK SMTP), always with at least one item. */
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

/** Invites someone into a tenant's organisation, sent from the tenant's own brand. */
async function sendTeamInvite({ to, organisationName, inviterName, roleName, inviteUrl, expiresAt, companyProfile, tenantId }) {
  return enqueueEmailJob({
    fromName: tenantFromName(companyProfile),
    tenantId,
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
      ...tenantBrandVars(companyProfile),
    },
  });
}

module.exports = {
  sendTeamInvite,
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
