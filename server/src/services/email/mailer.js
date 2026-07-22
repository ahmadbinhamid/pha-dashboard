// src/services/email/mailer.js

const nodemailer = require("nodemailer");
const { logger } = require("../../loaders/logging");
const config = require("../../config");

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false, // Mailtrap sandbox usually false
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  // Pooled + rate-limited: without this, concurrent worker jobs each open
  // their own SMTP connection and blast sends at once, which trips
  // "too many emails per second" on throttled sandboxes. Pooling paces
  // sends through the configured limit instead of firing them all at once.
  pool: true,
  maxConnections: config.smtp.maxConnections,
  rateLimit: config.smtp.rateLimit,
  rateDelta: config.smtp.rateDeltaMs,
});

async function sendEmail({ from, to, subject, html, text, attachments }) {
  const mail = {
    from:
      from ||
      `"${config.emailBrand.fromName}" <${config.emailBrand.fromEmail}>`,
    to,
    subject,
    html,
    text,
    attachments,
  };
  try {
    await transporter.sendMail(mail);
    return true;
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`, err);
    return false;
  }
}

module.exports = { sendEmail };
