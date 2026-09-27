// services/stripe/stripe.keys.service.js
// The only place that touches a tenant's encrypted Stripe credentials directly; every consumer
// goes through getDecryptedSecretKey/getStripeClient below instead.

const crypto = require("crypto");
const Tenant = require("../../models/Tenant");
const { logger } = require("../../loaders/logging");
const { encrypt, decrypt } = require("../../utils/crypto/tokenCipher");
const { buildStripeClient, getStripeClientForTenant, clearClientCache } = require("./stripe.client.service");
const { CONNECTION_STATUS } = require("../../constants/tenant.constants");

const SECRET_KEY_FIELDS = "+stripe_secret_key_ciphertext +stripe_secret_key_iv +stripe_secret_key_tag";
const WEBHOOK_SECRET_FIELDS =
  "+stripe_webhook_secret_ciphertext +stripe_webhook_secret_iv +stripe_webhook_secret_tag";

// Every event stripe.webhook.service.js handles; kept in sync with its switch statement.
const WEBHOOK_ENABLED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.refund.updated",
];

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function decryptSecretKey(tenant) {
  return decrypt({
    ciphertext: tenant.stripe_secret_key_ciphertext,
    iv: tenant.stripe_secret_key_iv,
    tag: tenant.stripe_secret_key_tag,
  });
}

function decryptWebhookSecret(tenant) {
  return decrypt({
    ciphertext: tenant.stripe_webhook_secret_ciphertext,
    iv: tenant.stripe_webhook_secret_iv,
    tag: tenant.stripe_webhook_secret_tag,
  });
}

async function getDecryptedSecretKey(tenantId) {
  const tenant = await Tenant.findById(tenantId).select(SECRET_KEY_FIELDS);
  if (!tenant) throw httpError("Tenant not found", 404);
  return decryptSecretKey(tenant);
}

// Every other Stripe-calling service uses this, never stripe.client.service directly.
async function getStripeClient(tenantId) {
  const secretKey = await getDecryptedSecretKey(tenantId);
  return getStripeClientForTenant(tenantId, secretKey);
}

// Registers our shared webhook URL directly on the tenant's Stripe account. Best-effort: a
// restricted API key without webhook_endpoints:write fails here without blocking key save,
// leaving webhook_configured false for manual completion via updateWebhookSecret.
async function registerWebhookEndpoint(tenantId, stripe, webhookUrl) {
  if (!webhookUrl) return;
  try {
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_ENABLED_EVENTS,
    });
    await updateWebhookSecret(tenantId, endpoint.secret);
  } catch (err) {
    logger.warn("[stripe.keys] Automatic webhook registration failed — falls back to manual setup", {
      tenantId: String(tenantId),
      error: err.message,
    });
  }
}

// Validates the key against Stripe (a cheap read-only call) before persisting, catching a
// typo'd/revoked key at save time. `webhookUrl`, if provided, triggers automatic webhook registration.
async function updateStripeKeys(tenantId, { secret_key, publishable_key }, webhookUrl) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw httpError("Tenant not found", 404);

  if (publishable_key !== undefined) tenant.stripe_publishable_key = publishable_key || null;

  let connectedStripeClient = null;

  if (secret_key !== undefined) {
    if (!secret_key) {
      tenant.stripe_secret_key_ciphertext = null;
      tenant.stripe_secret_key_iv = null;
      tenant.stripe_secret_key_tag = null;
      tenant.stripe_connection_status = CONNECTION_STATUS.NOT_CONNECTED;
      tenant.stripe_connected_at = null;
      tenant.stripe_last_error = null;
    } else {
      let testClient;
      try {
        testClient = buildStripeClient(secret_key);
        await testClient.balance.retrieve();
      } catch (err) {
        tenant.stripe_connection_status = CONNECTION_STATUS.ERROR;
        tenant.stripe_last_error = err.message;
        await tenant.save();
        throw httpError(`Stripe rejected this secret key: ${err.message}`, 400);
      }

      const { ciphertext, iv, tag } = encrypt(secret_key);
      tenant.stripe_secret_key_ciphertext = ciphertext;
      tenant.stripe_secret_key_iv = iv;
      tenant.stripe_secret_key_tag = tag;
      tenant.stripe_connection_status = CONNECTION_STATUS.CONNECTED;
      tenant.stripe_connected_at = new Date();
      tenant.stripe_last_error = null;
      connectedStripeClient = testClient;
    }
    clearClientCache(tenantId);
  }

  await tenant.save();
  logger.info("[stripe.keys] Keys updated", { tenantId: String(tenantId), connected: !!secret_key });

  if (connectedStripeClient) {
    await registerWebhookEndpoint(tenantId, connectedStripeClient, webhookUrl);
  }

  return getStripeStatus(tenantId);
}

async function ensureWebhookToken(tenantId) {
  let tenant = await Tenant.findById(tenantId);
  if (!tenant) throw httpError("Tenant not found", 404);

  if (!tenant.stripe_webhook_token) {
    tenant.stripe_webhook_token = crypto.randomBytes(24).toString("hex");
    await tenant.save();
    logger.info("[stripe.keys] Webhook token generated", { tenantId: String(tenantId) });
  }

  return tenant.stripe_webhook_token;
}

async function updateWebhookSecret(tenantId, webhookSecret) {
  const { ciphertext, iv, tag } = encrypt(webhookSecret || null);
  await Tenant.updateOne(
    { _id: tenantId },
    {
      $set: {
        stripe_webhook_secret_ciphertext: ciphertext,
        stripe_webhook_secret_iv: iv,
        stripe_webhook_secret_tag: tag,
      },
    },
  );
  logger.info("[stripe.keys] Webhook secret updated", { tenantId: String(tenantId) });
}

// Resolves the tenant/webhook-secret pair purely from the opaque URL token, mirroring
// ebay.settings.service.js#findByWebhookToken.
async function findByWebhookToken(webhookToken) {
  if (!webhookToken) return null;
  const tenant = await Tenant.findOne({ stripe_webhook_token: webhookToken }).select(WEBHOOK_SECRET_FIELDS);
  if (!tenant) return null;
  return { tenant, webhookSecret: decryptWebhookSecret(tenant) };
}

async function getStripeStatus(tenantId) {
  const tenant = await Tenant.findById(tenantId).select(WEBHOOK_SECRET_FIELDS);
  if (!tenant) throw httpError("Tenant not found", 404);

  return {
    connected: tenant.stripe_connection_status === CONNECTION_STATUS.CONNECTED,
    connection_status: tenant.stripe_connection_status,
    publishable_key: tenant.stripe_publishable_key,
    webhook_token: tenant.stripe_webhook_token,
    webhook_configured: !!tenant.stripe_webhook_secret_ciphertext,
    last_error: tenant.stripe_last_error,
  };
}

module.exports = {
  getDecryptedSecretKey,
  getStripeClient,
  updateStripeKeys,
  ensureWebhookToken,
  updateWebhookSecret,
  findByWebhookToken,
  getStripeStatus,
};
