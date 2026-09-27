// services/stripe/stripe.client.service.js
// BYOK: turns a secret key into a pinned-API-version Stripe SDK instance. No DB access, so
// stripe.keys.service.js can depend on it for key validation without a circular require.

const Stripe = require("stripe");
const { STRIPE_API_VERSION } = require("../../constants/stripe.constants");

// Keyed by tenantId. Cleared on a new secret key save so a revoked/rotated key is never cached.
const _clientCache = new Map(); // tenantId -> { client, secretKey }

function buildStripeClient(secretKey) {
  if (!secretKey) {
    throw Object.assign(new Error("Stripe is not configured for this tenant — add a secret key in Settings"), {
      status: 409,
    });
  }
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

// Reuses a cached instance only if the secret key hasn't changed since it was built.
function getStripeClientForTenant(tenantId, secretKey) {
  const key = String(tenantId);
  const cached = _clientCache.get(key);
  if (cached && cached.secretKey === secretKey) return cached.client;

  const client = buildStripeClient(secretKey);
  _clientCache.set(key, { client, secretKey });
  return client;
}

function clearClientCache(tenantId) {
  _clientCache.delete(String(tenantId));
}

module.exports = { buildStripeClient, getStripeClientForTenant, clearClientCache };
