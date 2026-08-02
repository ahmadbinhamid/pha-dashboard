// services/email/smtp.keys.service.js
//
// This is the only place in the codebase that touches a tenant's encrypted
// SMTP password directly. mailer.js is the only consumer that actually
// sends mail with it — everything else asks for a tenant-scoped transporter
// through getTransporterForTenant, never the raw credentials.

const nodemailer = require("nodemailer");
const Tenant = require("../../models/Tenant");
const { logger } = require("../../loaders/logging");
const { encrypt, decrypt } = require("../../utils/crypto/tokenCipher");
const { CONNECTION_STATUS } = require("../../constants/tenant.constants");

const SMTP_SELECT = "+smtp_pass_ciphertext +smtp_pass_iv +smtp_pass_tag";

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function decryptPass(tenant) {
  return decrypt({ ciphertext: tenant.smtp_pass_ciphertext, iv: tenant.smtp_pass_iv, tag: tenant.smtp_pass_tag });
}

function buildTransporter({ host, port, user, pass }) {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587/25/2525 all expect STARTTLS, not implicit TLS
    auth: { user, pass },
    // Conservative pooling defaults — a tenant's own mailbox provider (Gmail,
    // Office 365, etc.) throttles far more aggressively than a dedicated
    // transactional-email service. See config.smtp's own comment for the
    // platform transporter, which this mirrors.
    pool: true,
    maxConnections: 2,
    rateLimit: 5,
    rateDelta: 1000,
  });
}

function fingerprint(creds) {
  return [creds.host, creds.port, creds.user, creds.pass].join("|");
}

// Keyed by tenantId — avoids re-creating a pooled transporter (and its SMTP
// connections) on every email. Invalidated whenever credentials change (see
// updateSmtpCredentials) so a rotated/revoked password can't keep being used.
const _transporterCache = new Map(); // tenantId -> { transporter, fingerprint }

function clearTransporterCache(tenantId) {
  const cached = _transporterCache.get(String(tenantId));
  if (cached) cached.transporter.close();
  _transporterCache.delete(String(tenantId));
}

async function getDecryptedSmtpCredentials(tenantId) {
  const tenant = await Tenant.findById(tenantId).select(
    `${SMTP_SELECT} smtp_host smtp_port smtp_user smtp_from_name smtp_from_email`,
  );
  if (!tenant || !tenant.smtp_host || !tenant.smtp_port || !tenant.smtp_user) return null;
  const pass = decryptPass(tenant);
  if (!pass) return null;

  return {
    host: tenant.smtp_host,
    port: tenant.smtp_port,
    user: tenant.smtp_user,
    pass,
    fromName: tenant.smtp_from_name,
    fromEmail: tenant.smtp_from_email,
  };
}

// Returns null (not a throw) when this tenant hasn't configured their own
// SMTP — callers (mailer.js) fall back to the platform transporter in that case.
async function getTransporterForTenant(tenantId) {
  const creds = await getDecryptedSmtpCredentials(tenantId);
  if (!creds) return null;

  const key = String(tenantId);
  const fp = fingerprint(creds);
  const cached = _transporterCache.get(key);
  if (cached && cached.fingerprint === fp) return { transporter: cached.transporter, creds };

  const transporter = buildTransporter(creds);
  _transporterCache.set(key, { transporter, fingerprint: fp });
  return { transporter, creds };
}

// Validates against the SMTP server itself (a real connection + auth
// handshake, no message sent) before persisting — catching a typo'd host or
// wrong password at save time instead of on the next real order email.
// `pass` omitted entirely means "keep the currently saved password" (e.g.
// just changing the From name); "" clears it (disconnects).
async function updateSmtpCredentials(tenantId, { host, port, user, pass, from_name, from_email }) {
  const tenant = await Tenant.findById(tenantId).select(SMTP_SELECT);
  if (!tenant) throw httpError("Tenant not found", 404);

  if (from_name !== undefined) tenant.smtp_from_name = from_name || null;
  if (from_email !== undefined) tenant.smtp_from_email = from_email || null;

  const disconnecting = pass === "";
  if (disconnecting) {
    tenant.smtp_host = null;
    tenant.smtp_port = null;
    tenant.smtp_user = null;
    tenant.smtp_pass_ciphertext = null;
    tenant.smtp_pass_iv = null;
    tenant.smtp_pass_tag = null;
    tenant.smtp_connection_status = CONNECTION_STATUS.NOT_CONNECTED;
    tenant.smtp_connected_at = null;
    tenant.smtp_last_error = null;
    clearTransporterCache(tenantId);
    await tenant.save();
    logger.info("[smtp.keys] Credentials cleared", { tenantId: String(tenantId) });
    return getSmtpStatus(tenantId);
  }

  const finalHost = host !== undefined ? host || null : tenant.smtp_host;
  const finalPort = port !== undefined ? port || null : tenant.smtp_port;
  const finalUser = user !== undefined ? user || null : tenant.smtp_user;
  const finalPass = pass !== undefined && pass ? pass : decryptPass(tenant);

  const credentialsChanged = host !== undefined || port !== undefined || user !== undefined || (pass !== undefined && pass);

  if (credentialsChanged) {
    if (!finalHost || !finalPort || !finalUser || !finalPass) {
      throw httpError("Host, port, username and password are all required to connect", 400);
    }

    try {
      await buildTransporter({ host: finalHost, port: finalPort, user: finalUser, pass: finalPass }).verify();
    } catch (err) {
      tenant.smtp_connection_status = CONNECTION_STATUS.ERROR;
      tenant.smtp_last_error = err.message;
      await tenant.save();
      throw httpError(`SMTP server rejected these credentials: ${err.message}`, 400);
    }

    tenant.smtp_host = finalHost;
    tenant.smtp_port = finalPort;
    tenant.smtp_user = finalUser;
    const { ciphertext, iv, tag } = encrypt(finalPass);
    tenant.smtp_pass_ciphertext = ciphertext;
    tenant.smtp_pass_iv = iv;
    tenant.smtp_pass_tag = tag;
    tenant.smtp_connection_status = CONNECTION_STATUS.CONNECTED;
    tenant.smtp_connected_at = new Date();
    tenant.smtp_last_error = null;
    clearTransporterCache(tenantId);
  }

  await tenant.save();
  logger.info("[smtp.keys] Credentials updated", { tenantId: String(tenantId), connected: credentialsChanged });
  return getSmtpStatus(tenantId);
}

async function getSmtpStatus(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw httpError("Tenant not found", 404);

  return {
    connected: tenant.smtp_connection_status === CONNECTION_STATUS.CONNECTED,
    connection_status: tenant.smtp_connection_status,
    host: tenant.smtp_host,
    port: tenant.smtp_port,
    user: tenant.smtp_user,
    from_name: tenant.smtp_from_name,
    from_email: tenant.smtp_from_email,
    last_error: tenant.smtp_last_error,
  };
}

module.exports = {
  getDecryptedSmtpCredentials,
  getTransporterForTenant,
  clearTransporterCache,
  updateSmtpCredentials,
  getSmtpStatus,
};
