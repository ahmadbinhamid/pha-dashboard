// services/shipping/shippingQuote.service.js
// Cart shipping: flat rate per unit, plus a Transdirect quote when needed.

const Product = require("../../models/Product");
const { httpError } = require("../../utils/http/httpError");
const { toPackage, isCompletePackage } = require("../../utils/packageDimensions");
const { getTransdirectConfig } = require("./shippingSettings.service");
const { quoteShipment } = require("./transdirect.api.service");
const { SHIPPING_METHOD, ADDRESS_TYPE, QUOTE_CACHE_TTL_MS } = require("../../constants/shipping.constants");

const PRODUCT_FIELDS = "title price shipping_cost shipping_method package is_published_online";
const MAX_CACHE_ENTRIES = 1000;
const toCents = (dollars) => Math.round((dollars ?? 0) * 100);

// NOTE: per-process cache; a restart or 2nd API instance just re-quotes.
const quoteCache = new Map();

function cacheKey(tenantId, lines, receiver) {
  const cart = lines.map((l) => `${l.product._id}x${l.quantity}`).sort().join(",");
  return `${tenantId}|${cart}|${receiver.postcode}|${String(receiver.suburb).toUpperCase()}`;
}

function cached(key) {
  const hit = quoteCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  quoteCache.delete(key);
  return null;
}

function remember(key, value) {
  if (quoteCache.size >= MAX_CACHE_ENTRIES) quoteCache.delete(quoteCache.keys().next().value);
  quoteCache.set(key, { value, expires: Date.now() + QUOTE_CACHE_TTL_MS });
}

// One batched lookup; unknown or unpublished products fail the quote.
async function resolveLines(tenantId, items) {
  const ids = [...new Set(items.map((i) => String(i.product)))];
  const products = await Product.find({ _id: { $in: ids }, tenant_id: tenantId }).select(PRODUCT_FIELDS).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return items.map((i) => {
    const product = byId.get(String(i.product));
    if (!product || !product.is_published_online) throw httpError("Product not available", 400);
    return { product, quantity: i.quantity };
  });
}

async function quoteCalculated(tenantId, lines, receiver) {
  const config = await getTransdirectConfig(tenantId);
  if (!config) throw httpError("Calculated shipping isn't set up for this store yet", 422);
  const incomplete = lines.filter((l) => !isCompletePackage(l.product.package)).map((l) => l.product.title);
  if (incomplete.length) throw httpError(`Missing package size or weight: ${incomplete.join(", ")}`, 422);

  const quotes = await quoteShipment(config.apiKey, {
    declaredValue: lines.reduce((sum, l) => sum + (l.product.price ?? 0) * l.quantity, 0),
    items: lines.map((l) => ({ ...toPackage(l.product.package), quantity: l.quantity })),
    sender: config.sender,
    receiver: { postcode: receiver.postcode, suburb: receiver.suburb, state: receiver.state ?? "", type: ADDRESS_TYPE.RESIDENTIAL },
  });
  if (!quotes.length) throw httpError(`No courier delivers to ${receiver.suburb} ${receiver.postcode}`, 422);
  const [best] = quotes;
  return { cost: toCents(best.total), courier: best.courier, service: best.service, transit_time: best.transit_time };
}

/** Shipping for a cart in cents: flat rates plus the cheapest courier. */
async function quoteCart(tenantId, { items, receiver }) {
  const lines = await resolveLines(tenantId, items);
  const standard = lines.filter((l) => l.product.shipping_method !== SHIPPING_METHOD.CALCULATED);
  const calculatedLines = lines.filter((l) => l.product.shipping_method === SHIPPING_METHOD.CALCULATED);
  const standardCost = toCents(standard.reduce((sum, l) => sum + (l.product.shipping_cost ?? 0) * l.quantity, 0));

  let calculated = null;
  if (calculatedLines.length) {
    if (!receiver?.postcode || !receiver?.suburb) throw httpError("Postcode and suburb are needed to calculate shipping", 400);
    const key = cacheKey(tenantId, calculatedLines, receiver);
    calculated = cached(key) ?? (await quoteCalculated(tenantId, calculatedLines, receiver));
    remember(key, calculated);
  }

  return {
    shipping_cost: standardCost + (calculated?.cost ?? 0),
    standard_cost: standardCost,
    calculated_cost: calculated?.cost ?? 0,
    calculated,
    currency: "aud",
  };
}

/** Whether any cart product ships by calculated rate (one indexed query). */
async function hasCalculatedShipping(tenantId, items) {
  const ids = [...new Set(items.map((i) => String(i.product)))];
  return !!(await Product.exists({ _id: { $in: ids }, tenant_id: tenantId, shipping_method: SHIPPING_METHOD.CALCULATED }));
}

module.exports = { quoteCart, hasCalculatedShipping };
