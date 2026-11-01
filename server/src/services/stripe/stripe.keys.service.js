// services/stripe/stripe.keys.service.js
// Sole owner of tenants' encrypted Stripe keys; others use getStripeClient.

const crypto = require("crypto");
const Tenant = require("../../models/Tenant");
const { logger } = require("../../loaders/logging");
const { encrypt, decrypt } = require("../../utils/crypto/tokenCipher");
const { buildStripeClient, getStripeClientForTenant, clearClientCache } = require("./stripe.client.service");
const { CONNECTION_STATUS } = require("../../constants/tenant.constants");

const SECRET_KEY_FIELDS = "+stripe_secret_key_ciphertext +stripe_secret_key_iv +stripe_secret_key_tag";
const WEBHOOK_SECRET_FIELDS =
  "+stripe_webhook_secret_ciphertext +stripe_webhook_secret_iv +stripe_webhook_secret_tag";

// Every event stripe.webhook.service.js handles; keep in sync with its switch.
const WEBHOOK_ENABLED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.refund.updated",
];

const WEBHOOK_PATH = "/api/v1/payment/webhook";

/** One shared webhook URL for all tenants; the ?wt= token says which. */
function buildWebhookUrl(baseUrl, webhookToken) {
  return `${String(baseUrl).replace(/\/+$/, "")}${WEBHOOK_PATH}?wt=${webhookToken}`;
}

// Ours, for this tenant: our webhook path carrying this tenant's own token.
function isTenantEndpoint(endpoint, webhookToken) {
  try {
    const url = new URL(endpoint.url);
    return url.pathname === WEBHOOK_PATH && url.searchParams.get("wt") === webhookToken;
  } catch {
    return false;
  }
}

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

// Every other Stripe-calling service uses this, not stripe.client.service.
async function getStripeClient(tenantId) {
  const secretKey = await getDecryptedSecretKey(tenantId);
  return getStripeClientForTenant(tenantId, secretKey);
}

// Best-effort: a restricted key can't write webhooks; save still succeeds.
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

// Checks the key with a cheap Stripe read first; webhookUrl auto-registers.
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

// Tenant and webhook secret from the opaque URL token, as eBay's lookup does.
async function findByWebhookToken(webhookToken) {
  if (!webhookToken) return null;
  const tenant = await Tenant.findOne({ stripe_webhook_token: webhookToken }).select(WEBHOOK_SECRET_FIELDS);
  if (!tenant) return null;
  return { tenant, webhookSecret: decryptWebhookSecret(tenant) };
}

/** Points one tenant's endpoint(s) at baseUrl; same id, so the secret stays. */
async function retargetTenantEndpoints(tenant, baseUrl, { dryRun, clientFor }) {
  const target = buildWebhookUrl(baseUrl, tenant.stripe_webhook_token);
  const stripe = clientFor(decryptSecretKey(tenant));
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });
  const ours = endpoints.filter((ep) => isTenantEndpoint(ep, tenant.stripe_webhook_token));
  if (!ours.length) return [{ status: "no_endpoint", to: target }];

  const results = [];
  for (const endpoint of ours) {
    if (endpoint.url === target) {
      results.push({ status: "already_current", endpoint: endpoint.id, from: endpoint.url });
      continue;
    }
    if (!dryRun) await stripe.webhookEndpoints.update(endpoint.id, { url: target });
    results.push({ status: dryRun ? "would_update" : "updated", endpoint: endpoint.id, from: endpoint.url, to: target });
  }
  return results;
}

/** Every tenant with keys; one tenant's Stripe error never stops the rest. */
async function retargetWebhookEndpoints({ baseUrl, dryRun = true, tenantId = null, onResult, clientFor = buildStripeClient }) {
  const filter = { stripe_webhook_token: { $ne: null }, stripe_secret_key_ciphertext: { $ne: null } };
  if (tenantId) filter._id = tenantId;
  const tenants = Tenant.find(filter).select(`${SECRET_KEY_FIELDS} stripe_webhook_token company_name name`).cursor();

  const summary = {};
  for await (const tenant of tenants) {
    let results;
    try {
      results = await retargetTenantEndpoints(tenant, baseUrl, { dryRun, clientFor });
    } catch (err) {
      results = [{ status: "error", error: err.message }];
    }
    for (const result of results) {
      summary[result.status] = (summary[result.status] ?? 0) + 1;
      onResult?.({ tenantId: tenant._id, tenantName: tenant.company_name || tenant.name, ...result });
    }
  }
  return summary;
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
  buildWebhookUrl,
  retargetWebhookEndpoints,
};
