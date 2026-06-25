// services/ebay/ebay.policies.service.js
// eBay Sell Account API — business policies (fulfillment / payment / return)
//
// API reference: https://developer.ebay.com/api-docs/sell/account/resources/
//   fulfillment_policy GET  /sell/account/v1/fulfillment_policy?marketplace_id=…
//   payment_policy     GET  /sell/account/v1/payment_policy?marketplace_id=…
//   return_policy      GET  /sell/account/v1/return_policy?marketplace_id=…
//
// All three require the sell.account OAuth scope, which is already included in
// the refresh-token grant in ebay.api.service.js.

const config = require("../../config");
const { getAccessToken, ebayHeaders } = require("./ebay.api.service");
const { logger } = require("../../loaders/logging");

const ACCOUNT_BASE = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com/sell/account/v1"
  : "https://api.ebay.com/sell/account/v1";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
let _cache = null;
let _cacheExpiry = 0;

async function fetchPolicies(token, resource, listKey, idKey) {
  const url = `${ACCOUNT_BASE}/${resource}?marketplace_id=${encodeURIComponent(config.ebay.marketplaceId)}`;
  const res = await fetch(url, { headers: ebayHeaders(token) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${resource} failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return (data[listKey] || []).map((p) => ({ id: p[idKey], name: p.name }));
}

async function getBusinessPolicies() {
  if (_cache && Date.now() < _cacheExpiry) return _cache;

  const token = await getAccessToken();
  if (!token) throw new Error("Could not obtain eBay access token");

  const [fulfillment, payment, returnPolicies] = await Promise.all([
    fetchPolicies(token, "fulfillment_policy", "fulfillmentPolicies", "fulfillmentPolicyId"),
    fetchPolicies(token, "payment_policy", "paymentPolicies", "paymentPolicyId"),
    fetchPolicies(token, "return_policy", "returnPolicies", "returnPolicyId"),
  ]);

  logger.info(
    `[eBay policies] fetched ${fulfillment.length} fulfillment, ${payment.length} payment, ${returnPolicies.length} return policies`,
  );

  _cache = { fulfillment, payment, return: returnPolicies };
  _cacheExpiry = Date.now() + TTL_MS;
  return _cache;
}

module.exports = { getBusinessPolicies };
