// src/services/email/mailer.js

const nodemailer = require("nodemailer");
const { logger } = require("../../loaders/logging");
const config = require("../../config");
const { getTransporterForTenant } = require("./smtp.keys.service");

// Platform transporter: always used for system email, and as the fallback when a tenant has no own SMTP.
const platformTransporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, // implicit TLS on 465; 587/25/2525 use STARTTLS
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  // Pooled + rate-limited, so concurrent worker jobs don't trip "too many emails per second".
  pool: true,
  maxConnections: config.smtp.maxConnections,
  rateLimit: config.smtp.rateLimit,
  rateDelta: config.smtp.rateDeltaMs,
});

// `from` is a full pre-built string, only safe for platform-level sends. `fromName` is a
// display-name-only alternative for order email, since most SMTP providers reject a From
// address that doesn't match the authenticated mailbox. tenantId is omitted for platform sends.
async function sendEmail({ from, to, subject, html, text, attachments, tenantId, fromName }) {
  let transporter = platformTransporter;
  let resolvedFrom = from;

  if (!resolvedFrom && tenantId) {
    const tenantSmtp = await getTransporterForTenant(tenantId);
    if (tenantSmtp) {
      transporter = tenantSmtp.transporter;
      resolvedFrom = `"${fromName || tenantSmtp.creds.fromName || tenantSmtp.creds.user}" <${tenantSmtp.creds.fromEmail || tenantSmtp.creds.user}>`;
    }
    // No tenant SMTP configured — falls through to the platform transporter below.
  }

  if (!resolvedFrom) {
    resolvedFrom = `"${fromName || config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`;
  }

  const mail = { from: resolvedFrom, to, subject, html, text, attachments };
  try {
    await transporter.sendMail(mail);
    return true;
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`, err);
    return false;
  }
}

module.exports = { sendEmail };
