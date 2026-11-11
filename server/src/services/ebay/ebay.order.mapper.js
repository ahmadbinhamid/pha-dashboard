// services/ebay/ebay.order.mapper.js
// Pure eBay Order -> order.service shape; masked buyer PII gets placeholders.

const { gstFromInclusive } = require("../../utils/orderTotals");

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
    // Managed Payments rarely exposes a real email; use a marked placeholder.
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

// Line total (covers qty > 1), then unit cost, else 0 flagged for review.
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

// Motors freight can fold shipping into line totals; trust priceSubtotal.
function reconcileLineItemTotals(lineItems, subtotalCents) {
  if (!lineItems.length || subtotalCents == null) return;

  const sumCents = lineItems.reduce((sum, li) => sum + li.unitPriceCents * li.quantity, 0);
  const diff = sumCents - subtotalCents;

  // Only reconcile beyond ~1 cent/item of expected rounding drift.
  if (Math.abs(diff) <= lineItems.length) return;

  if (lineItems.length === 1) {
    const [only] = lineItems;
    only.unitPriceCents = Math.round(subtotalCents / only.quantity);
    return;
  }

  // Multiple items: prorate the subtotal by each item's reported total.
  let allocated = 0;
  lineItems.forEach((li, idx) => {
    const isLast = idx === lineItems.length - 1;
    const itemTotal = isLast
      ? subtotalCents - allocated
      : Math.round((li.unitPriceCents * li.quantity * subtotalCents) / sumCents);
    allocated += itemTotal;
    li.unitPriceCents = Math.round(itemTotal / li.quantity);
  });
}

// Maps eBay status to ORDER_STATUS; refunds and disputes are not mapped.
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

  if (pricing.priceSubtotal?.value != null) {
    reconcileLineItemTotals(lineItems, subtotalCents);
  }

  const shippingCents = pricing.deliveryCost?.value != null ? toCents(pricing.deliveryCost.value) : 0;
  const totalCents = pricing.total?.value != null
    ? toCents(pricing.total.value)
    : subtotalCents + shippingCents;
  // eBay-reported tax is kept as is; the fallback adds freight GST too.
  const ebayTax = pricing.tax?.value != null;
  const taxCents = ebayTax
    ? toCents(pricing.tax.value)
    : gstFromInclusive(subtotalCents) + gstFromInclusive(shippingCents);

  // Falls back to the tenant marketplace currency in order.service.js.
  const currency = pricing.total?.currency || pricing.priceSubtotal?.currency || null;

  return {
    externalOrderId: rawOrder.orderId,
    externalBuyerUsername: rawOrder.buyer?.username || null,
    customer: mapCustomer(rawOrder, shipTo),
    shippingAddress: mapShippingAddress(shipTo),
    lineItems,
    subtotalCents,
    shippingCents,
    taxCents,
    gstIncludesShipping: !ebayTax,
    totalCents,
    currency,
    status: mapStatus(rawOrder, { ORDER_STATUS }),
  };
}

module.exports = { mapEbayOrder };
