// services/ebay/ebay.policies.service.js
// eBay Sell Account API — business policies (fulfillment / payment / return)
//
// API reference: https://developer.ebay.com/api-docs/sell/account/resources/
//   fulfillment_policy GET  /sell/account/v1/fulfillment_policy?marketplace_id=…
//   payment_policy     GET  /sell/account/v1/payment_policy?marketplace_id=…
//   return_policy      GET  /sell/account/v1/return_policy?marketplace_id=…
//
// All three require the sell.account OAuth scope, which is already included in
// the refresh-token grant in ebay.api.service.js. Tenant-scoped — each
// seller's own business policies live under their own access token.

const { getAccessToken, ebayHeaders, apiBaseUrlFor } = require("./ebay.api.service");
const { logger } = require("../../loaders/logging");

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const _cache = new Map(); // tenantId -> { data, expiry }

async function fetchPolicies(token, settings, resource, listKey, idKey) {
  const accountBase = `${apiBaseUrlFor(settings.sandbox)}/sell/account/v1`;
  const url = `${accountBase}/${resource}?marketplace_id=${encodeURIComponent(settings.marketplace_id)}`;
  const res = await fetch(url, { headers: ebayHeaders(token, settings.marketplace_id) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${resource} failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return (data[listKey] || []).map((p) => ({ id: p[idKey], name: p.name }));
}

async function getBusinessPolicies(settings) {
  const cacheKey = String(settings.tenant_id);
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.data;

  const token = await getAccessToken(settings);
  if (!token) throw new Error("Could not obtain eBay access token");

  const [fulfillment, payment, returnPolicies] = await Promise.all([
    fetchPolicies(token, settings, "fulfillment_policy", "fulfillmentPolicies", "fulfillmentPolicyId"),
    fetchPolicies(token, settings, "payment_policy", "paymentPolicies", "paymentPolicyId"),
    fetchPolicies(token, settings, "return_policy", "returnPolicies", "returnPolicyId"),
  ]);

  logger.info(
    `[eBay policies] fetched ${fulfillment.length} fulfillment, ${payment.length} payment, ${returnPolicies.length} return policies`,
  );

  const result = { fulfillment, payment, return: returnPolicies };
  _cache.set(cacheKey, { data: result, expiry: Date.now() + TTL_MS });
  return result;
}

module.exports = { getBusinessPolicies };
