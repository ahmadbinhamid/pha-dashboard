// utils/orderTotals.js
// The one GST-inclusive totals formula for order creation and every edit.

const GST_RATE_PERCENT = 10;
// AU prices include GST: 10% on ex-GST is 1/11 of the inclusive price.
const GST_DIVISOR = 1 + 100 / GST_RATE_PERCENT;
const GST_LABEL = `GST (${GST_RATE_PERCENT}%)`;

/** GST component of a GST-inclusive amount in cents. */
function gstFromInclusive(inclusiveCents) {
  return Math.round(inclusiveCents / GST_DIVISOR);
}

/** subtotal, tax_amount and total in cents from items (cents) and shipping. */
function computeOrderTotals(items, { shippingCost = 0, orderDiscount = 0 } = {}) {
  const subtotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity - (i.discount_amount || 0)), 0);
  return {
    subtotal,
    // Freight is a taxable supply; its GST is added as its own rounded part.
    tax_amount: gstFromInclusive(subtotal) + gstFromInclusive(shippingCost),
    gst_includes_shipping: true,
    total: subtotal - orderDiscount + shippingCost,
  };
}

/** Splits stored GST into items and freight; legacy has no freight GST. */
function splitOrderGst(order) {
  const totalGst = order.tax_amount || 0;
  const freightGst = order.gst_includes_shipping ? gstFromInclusive(order.shipping_cost || 0) : 0;
  return { totalGst, freightGst, itemsGst: totalGst - freightGst };
}

module.exports = {
  computeOrderTotals,
  gstFromInclusive,
  splitOrderGst,
  GST_DIVISOR,
  GST_RATE_PERCENT,
  GST_LABEL,
};
