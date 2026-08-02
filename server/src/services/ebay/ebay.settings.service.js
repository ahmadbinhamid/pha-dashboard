// services/ebay/ebay.settings.service.js
//
// This is the only place in the codebase that touches the encrypted
// refresh_token fields directly. Every other consumer (ebay.api.service.js,
// ebay.adapter.js, sync.service.js, ...) keeps reading/writing a plain
// `settings.refresh_token` string exactly as before — encryption happens
// transparently here on the way in and out of Mongo.

const crypto = require("crypto");
const EbaySettings = require("../../models/EbaySettings");
const { logger } = require("../../loaders/logging");
const { encrypt, decrypt } = require("../../utils/crypto/tokenCipher");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");

const SECRET_FIELDS = "+refresh_token_ciphertext +refresh_token_iv +refresh_token_tag";

// Replaces the ciphertext/iv/tag trio on a lean doc with a plain
// `refresh_token` string (or null), matching the shape every existing
// consumer already expects.
function withDecryptedRefreshToken(doc) {
  if (!doc) return doc;
  const refresh_token = decrypt({
    ciphertext: doc.refresh_token_ciphertext,
    iv: doc.refresh_token_iv,
    tag: doc.refresh_token_tag,
  });
  const { refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, ...rest } = doc;
  return { ...rest, refresh_token };
}

async function getSettings(tenantId) {
  const doc = await EbaySettings.findOne({ tenant_id: tenantId }).select(SECRET_FIELDS).lean();
  return withDecryptedRefreshToken(doc) || {};
}

async function upsertSettings(tenantId, update) {
  const { refresh_token, ...rest } = update;
  const setFields = { ...rest };

  if (refresh_token !== undefined) {
    const { ciphertext, iv, tag } = encrypt(refresh_token);
    setFields.refresh_token_ciphertext = ciphertext;
    setFields.refresh_token_iv = iv;
    setFields.refresh_token_tag = tag;
    setFields.connection_status = refresh_token
      ? EBAY_CONNECTION_STATUS.CONNECTED
      : EBAY_CONNECTION_STATUS.NOT_CONNECTED;
    setFields.connected_at = refresh_token ? new Date() : null;
    if (refresh_token) setFields.last_error = null;
  }

  const settings = await EbaySettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set: setFields },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .select(SECRET_FIELDS)
    .lean();

  logger.info("[ebay.settings] Settings updated", { tenantId: String(tenantId), fields: Object.keys(setFields) });
  return withDecryptedRefreshToken(settings);
}

// Records a connection failure surfaced by the API/poller (e.g. a revoked or
// expired refresh_token) so Settings can show it instead of failing silently.
async function markConnectionError(tenantId, { status = EBAY_CONNECTION_STATUS.ERROR, message } = {}) {
  await EbaySettings.updateOne({ tenant_id: tenantId }, { $set: { connection_status: status, last_error: message ?? null } });
  logger.warn("[ebay.settings] Connection marked as errored", { tenantId: String(tenantId), status, message });
}

async function ensureVerificationToken(tenantId) {
  let settings = await EbaySettings.findOne({ tenant_id: tenantId });
  if (!settings) settings = new EbaySettings({ tenant_id: tenantId });

  if (!settings.verification_token) {
    settings.verification_token = crypto.randomBytes(32).toString("hex");
    await settings.save();
    logger.info("[ebay.settings] Verification token generated and saved", { tenantId: String(tenantId) });
  }

  return settings.verification_token;
}

// Opaque, unguessable identifier used in the shared webhook URL's query
// string in place of this tenant's real _id (see EbaySettings.webhook_token).
async function ensureWebhookToken(tenantId) {
  let settings = await EbaySettings.findOne({ tenant_id: tenantId });
  if (!settings) settings = new EbaySettings({ tenant_id: tenantId });

  if (!settings.webhook_token) {
    settings.webhook_token = crypto.randomBytes(24).toString("hex");
    await settings.save();
    logger.info("[ebay.settings] Webhook token generated and saved", { tenantId: String(tenantId) });
  }

  return settings.webhook_token;
}

// Resolves the tenant/settings pair a webhook delivery belongs to, purely
// from the opaque token in its URL — the real tenant_id never appears there.
async function findByWebhookToken(webhookToken) {
  if (!webhookToken) return null;
  const doc = await EbaySettings.findOne({ webhook_token: webhookToken }).select(SECRET_FIELDS).lean();
  return withDecryptedRefreshToken(doc);
}

// Every tenant that has completed enough setup to actually call eBay's API —
// used by the worker's poll loop and anywhere else that needs to iterate
// "every eBay-enabled store" rather than operate on one already-known tenant.
async function listConfiguredTenants() {
  const docs = await EbaySettings.find({ refresh_token_ciphertext: { $ne: null } })
    .select(SECRET_FIELDS)
    .lean();
  return docs.map(withDecryptedRefreshToken);
}

module.exports = {
  getSettings,
  upsertSettings,
  markConnectionError,
  ensureVerificationToken,
  ensureWebhookToken,
  findByWebhookToken,
  listConfiguredTenants,
};
