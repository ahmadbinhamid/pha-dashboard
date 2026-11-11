// src/services/email/mailer.js

const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const { logger } = require("../../loaders/logging");
const config = require("../../config");
const { getTransporterForTenant } = require("./smtp.keys.service");
const { renderDocument } = require("./templateLoader");

function platformDkim() {
  const { domainName, keySelector, privateKey } = config.smtp.dkim;
  return domainName && keySelector && privateKey ? { domainName, keySelector, privateKey } : undefined;
}

// Platform transporter for system mail and tenants without their own SMTP.
const platformTransporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, // implicit TLS on 465; others use STARTTLS
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
  dkim: platformDkim(),
  // Pooled + rate-limited so concurrent jobs don't trip provider throttles.
  pool: true,
  maxConnections: config.smtp.maxConnections,
  rateLimit: config.smtp.rateLimit,
  rateDelta: config.smtp.rateDeltaMs,
});

// HTML-only mail scores as spam (MIME_HTML_ONLY), so always add a text part.
function htmlToPlainText(html) {
  return convert(html, {
    wordwrap: 78,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    ],
  });
}

const domainOf = (address) => String(address || "").split("@")[1]?.replace(/>$/, "") || null;

// SMTP 5xx is a permanent rejection; retrying only damages sender reputation.
const isPermanentFailure = (err) => err?.responseCode >= 500 && err?.responseCode < 600;

/** Picks transporter and From; tenant SMTP wins, platform mailbox otherwise. */
async function resolveSender({ from, fromName, tenantId }) {
  if (from) return { transporter: platformTransporter, from, via: "platform" };
  if (tenantId) {
    const tenantSmtp = await getTransporterForTenant(tenantId);
    if (tenantSmtp) {
      const { creds } = tenantSmtp;
      const name = fromName || creds.fromName || creds.user;
      // Most SMTP hosts reject a From that isn't the authenticated mailbox.
      const address = creds.fromEmail || creds.user;
      return { transporter: tenantSmtp.transporter, from: `"${name}" <${address}>`, via: "tenant" };
    }
  }
  const name = fromName || config.emailBrand.fromName;
  return { transporter: platformTransporter, from: `"${name}" <${config.emailBrand.fromEmail}>`, via: "platform" };
}

/** Sends one message; returns { ok, permanent } and never throws. */
async function sendEmail({ from, fromName, replyTo, to, subject, html, text, attachments, tenantId, template }) {
  const sender = await resolveSender({ from, fromName, tenantId });
  const mail = {
    from: sender.from,
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
    text: text || (html ? htmlToPlainText(html) : undefined),
    attachments,
  };
  const meta = {
    template,
    tenantId: tenantId ? String(tenantId) : null,
    via: sender.via,
    fromDomain: domainOf(sender.from),
    to,
    subject,
  };

  try {
    const info = await sender.transporter.sendMail(mail);
    logger.info("[mailer] accepted", {
      ...meta,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
    const rejected = Boolean(info.rejected?.length);
    return { ok: !rejected, permanent: rejected };
  } catch (err) {
    const permanent = isPermanentFailure(err);
    logger.error("[mailer] send failed", {
      ...meta,
      error: err.message,
      code: err.code,
      responseCode: err.responseCode,
      response: err.response,
      command: err.command,
      permanent,
    });
    return { ok: false, permanent };
  }
}

/** Bull "send" processor shared by email.worker and platform.worker. */
async function processEmailJob(job) {
  const { to, subject, template, variables, from, fromName, replyTo, tenantId, text, attachments } = job.data;
  const html = renderDocument(template, variables, subject);
  const result = await sendEmail({ from, fromName, replyTo, tenantId, to, subject, html, text, attachments, template });
  if (result.ok) return true;
  if (result.permanent) await job.discard();
  throw new Error(result.permanent ? "Email permanently rejected" : "Failed to send email");
}

module.exports = { sendEmail, processEmailJob };
