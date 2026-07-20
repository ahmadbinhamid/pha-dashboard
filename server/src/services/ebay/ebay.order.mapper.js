// services/ebay/ebay.order.mapper.js
//
// Pure transform: raw eBay Order resource (Sell Fulfillment API) -> the plain
// shape order.service.js needs to build a local Order. No DB access here —
// keeps the field-mapping logic (the part most likely to need tweaking once
// we see real eBay payloads) isolated and independently testable from the
// persistence logic in order.service.js.
//
// Field names below follow eBay's documented Order resource. eBay masks or
// omits buyer PII in most regions (Managed Payments) — email/phone are best-
// effort with clear placeholders when absent, never a hard failure, since we
// still need to satisfy Order's required customer fields.

const GST_DIVISOR = 11; // AU GST is 1/11 of a GST-inclusive price — same convention order.service.js uses

function toCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function extractShipTo(rawOrder) {
  return rawOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || null;
}

function mapCustomer(rawOrder, shipTo) {
  const username = rawOrder.buyer?.username || null;
  return {
    name: shipTo?.fullName || username || "eBay buyer",
    // eBay rarely exposes a real email under Managed Payments — fall back to
    // a clearly-marked placeholder rather than fail the required field.
    email: shipTo?.email || (username ? `${username}@ebay.marketplace` : "unknown@ebay.marketplace"),
    phone: shipTo?.primaryPhone?.phoneNumber || shipTo?.phoneNumber || "Not provided",
  };
}

function mapShippingAddress(shipTo) {
  const addr = shipTo?.contactAddress || {};
  const line = [addr.addressLine1, addr.addressLine2].filter(Boolean).join(", ");
  return {
    address: line || "Not provided",
    suburb: addr.city || "Not provided",
    state: addr.stateOrProvince || "Not provided",
    postcode: addr.postalCode || "0000",
  };
}

// Per line item: prefer the line's own total (covers quantity > 1 correctly),
// fall back to per-unit cost, fall back to 0 with the item flagged for review
// rather than guessing.
function mapLineItem(item) {
  const quantity = Number(item.quantity) || 1;
  const lineTotalRaw = item.total?.value;
  const unitCostRaw = item.lineItemCost?.value;

  let unitPriceCents;
  if (lineTotalRaw != null) {
    unitPriceCents = Math.round(toCents(lineTotalRaw) / quantity);
  } else if (unitCostRaw != null) {
    unitPriceCents = toCents(unitCostRaw);
  } else {
    unitPriceCents = 0;
  }

  return {
    sku: item.sku || null,
    title: item.title || item.sku || "eBay item",
    quantity,
    unitPriceCents,
    priceUnresolved: lineTotalRaw == null && unitCostRaw == null,
  };
}

// eBay's orderFulfillmentStatus/orderPaymentStatus -> our ORDER_STATUS.
// Anything beyond "paid" vs "fulfilled" (refunds, partial refunds, disputes)
// is explicitly out of scope for this phase — surfaced later if needed.
function mapStatus(rawOrder, { ORDER_STATUS }) {
  if (rawOrder.orderFulfillmentStatus === "FULFILLED") return ORDER_STATUS.FULFILLED;
  return ORDER_STATUS.PAID;
}

function mapEbayOrder(rawOrder, { ORDER_STATUS }) {
  const shipTo = extractShipTo(rawOrder);
  const lineItems = (rawOrder.lineItems || []).map(mapLineItem);

  const pricing = rawOrder.pricingSummary || {};
  const subtotalCents = pricing.priceSubtotal?.value != null
    ? toCents(pricing.priceSubtotal.value)
    : lineItems.reduce((sum, li) => sum + li.unitPriceCents * li.quantity, 0);
  const shippingCents = pricing.deliveryCost?.value != null ? toCents(pricing.deliveryCost.value) : 0;
  const totalCents = pricing.total?.value != null
    ? toCents(pricing.total.value)
    : subtotalCents + shippingCents;
  const taxCents = pricing.tax?.value != null ? toCents(pricing.tax.value) : Math.round(subtotalCents / GST_DIVISOR);

  return {
    externalOrderId: rawOrder.orderId,
    externalBuyerUsername: rawOrder.buyer?.username || null,
    customer: mapCustomer(rawOrder, shipTo),
    shippingAddress: mapShippingAddress(shipTo),
    lineItems,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    status: mapStatus(rawOrder, { ORDER_STATUS }),
  };
}

module.exports = { mapEbayOrder };
