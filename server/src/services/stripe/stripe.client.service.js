// services/stripe/stripe.client.service.js
//
// BYOK — every tenant supplies their own Stripe secret key (server/src/
// services/stripe/stripe.keys.service.js), so there is no single platform
// client anymore. This module only knows how to turn a secret key into a
// pinned-API-version Stripe SDK instance; it has no DB access itself so
// stripe.keys.service.js can depend on it (for key validation) without a
// circular require.

const Stripe = require("stripe");
const { STRIPE_API_VERSION } = require("../../constants/stripe.constants");

// Keyed by tenantId — avoids re-constructing a Stripe instance on every
// call. Cleared whenever a tenant saves a new secret key (see
// stripe.keys.service.js#updateStripeKeys) so a revoked/rotated key can
// never keep being served from cache.
const _clientCache = new Map(); // tenantId -> { client, secretKey }

function buildStripeClient(secretKey) {
  if (!secretKey) {
    throw Object.assign(new Error("Stripe is not configured for this tenant — add a secret key in Settings"), {
      status: 409,
    });
  }
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

// Reuses a cached instance only if the secret key hasn't changed since it
// was built — cheap to compare, and correct even if clearClientCache was
// missed somewhere.
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
