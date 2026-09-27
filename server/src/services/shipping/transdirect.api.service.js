// services/shipping/transdirect.api.service.js
// Pure Transdirect HTTP client (no DB); callers pass the tenant's API key.

const { httpError } = require("../../utils/http/httpError");
const { TRANSDIRECT } = require("../../constants/shipping.constants");

function headers(apiKey) {
  return { "Api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

// Flattens nested field errors, e.g. { errors: { sender: { state: [...] } } }.
function errorDetail(body) {
  if (body?.message) return body.message;
  const parts = [];
  const walk = (node, path) => {
    if (typeof node === "string") parts.push(path ? `${path}: ${node}` : node);
    else if (Array.isArray(node)) node.forEach((item) => walk(item, path));
    else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => walk(v, path ? `${path} ${k}` : k));
  };
  walk(body?.errors, "");
  return parts.join("; ");
}

// 4xx is the request (bad postcode, oversize item); 5xx/network is Transdirect.
async function send(path, apiKey, init = {}) {
  let res;
  try {
    res = await fetch(`${TRANSDIRECT.BASE_URL}${path}`, {
      ...init,
      headers: headers(apiKey),
      signal: AbortSignal.timeout(TRANSDIRECT.TIMEOUT_MS),
    });
  } catch (err) {
    throw httpError(`Transdirect unreachable: ${err.message}`, 503, { cause: err });
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) throw httpError("Transdirect rejected the API key", 422);
  if (!res.ok) {
    // HTTP/2 responses carry no statusText, so fall back to the code.
    const detail = errorDetail(body) || `HTTP ${res.status}`;
    throw httpError(`Transdirect error: ${detail}`, res.status >= 500 ? 502 : 422);
  }
  return body;
}

// Flattens { courier: { total } } or a list; a missing price never reads as $0.
function toQuotes(quotes = {}) {
  const entries = Array.isArray(quotes) ? quotes.map((q) => [q?.courier ?? q?.service, q]) : Object.entries(quotes ?? {});
  return entries
    .filter(([, q]) => q?.total != null && q.total !== "" && Number(q.total) > 0)
    .map(([courier, q]) => ({
      courier,
      total: Number(q.total),
      service: q.service ?? null,
      transit_time: q.transit_time ?? null,
    }))
    .sort((a, b) => a.total - b.total);
}

/** Quotes a shipment; returns couriers cheapest first (totals in dollars). */
async function quoteShipment(
  apiKey,
  { declaredValue, items, sender, receiver, requestingSite, tailgatePickup = false, tailgateDelivery = false },
) {
  // NOTE: v4 "quick quote" is a draft booking; nothing ships until confirmed.
  const body = await send("/bookings/v4", apiKey, {
    method: "POST",
    body: JSON.stringify({
      declared_value: Number(declaredValue.toFixed(2)),
      referrer: TRANSDIRECT.REFERRER,
      requesting_site: requestingSite,
      tailgate_pickup: tailgatePickup,
      tailgate_delivery: tailgateDelivery,
      items: items.map((i) => ({ ...i, description: TRANSDIRECT.ITEM_DESCRIPTION })),
      sender: { ...sender, country: TRANSDIRECT.COUNTRY },
      receiver: { ...receiver, country: TRANSDIRECT.COUNTRY },
    }),
  });
  const quotes = toQuotes(body?.quotes);
  if (!quotes.length && couriersUnavailable(body?.quote_errors)) {
    throw httpError("Couriers aren't responding right now; please try again shortly", 503);
  }
  return quotes;
}

// Every courier failing with a retryable error is an outage, not a bad address.
function couriersUnavailable(errors) {
  return Array.isArray(errors) && errors.length > 0 && errors.every((e) => e?.retryable);
}

/** Suburbs for a postcode, e.g. for a ship-from address picker. */
async function locationsForPostcode(apiKey, postcode) {
  const body = await send(`/locations/postcode/${encodeURIComponent(postcode)}`, apiKey);
  return Object.values(body?.locations ?? {}).map((l) => ({ suburb: l.locality, postcode: l.postcode, state: l.state }));
}

module.exports = { quoteShipment, locationsForPostcode, toQuotes, errorDetail };
