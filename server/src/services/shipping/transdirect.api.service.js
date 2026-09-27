// services/shipping/transdirect.api.service.js
// Pure Transdirect HTTP client (no DB); callers pass the tenant's API key.

const { httpError } = require("../../utils/http/httpError");
const { TRANSDIRECT } = require("../../constants/shipping.constants");

function headers(apiKey) {
  return { "Api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
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
    const detail = body?.message || body?.errors?.[0]?.message || res.statusText;
    throw httpError(`Transdirect error: ${detail}`, res.status >= 500 ? 502 : 422);
  }
  return body;
}

// Flattens { courier: { total } }; a missing price must never read as $0.
function toQuotes(quotes = {}) {
  return Object.entries(quotes)
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
async function quoteShipment(apiKey, { declaredValue, items, sender, receiver }) {
  // NOTE: v4 "quick quote" is a draft booking; nothing ships until confirmed.
  const body = await send("/bookings/v4", apiKey, {
    method: "POST",
    body: JSON.stringify({
      declared_value: declaredValue.toFixed(2),
      referrer: "API",
      description: "Auto parts",
      items: items.map((i) => ({ ...i, description: TRANSDIRECT.ITEM_DESCRIPTION })),
      sender: { ...sender, country: TRANSDIRECT.COUNTRY },
      receiver: { ...receiver, country: TRANSDIRECT.COUNTRY },
    }),
  });
  return toQuotes(body?.quotes);
}

/** Suburbs for a postcode, e.g. for a ship-from address picker. */
async function locationsForPostcode(apiKey, postcode) {
  const body = await send(`/locations/postcode/${encodeURIComponent(postcode)}`, apiKey);
  return Object.values(body?.locations ?? {}).map((l) => ({ suburb: l.locality, postcode: l.postcode, state: l.state }));
}

module.exports = { quoteShipment, locationsForPostcode, toQuotes };
