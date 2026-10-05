// utils/orderTotals.js
// The one GST-inclusive totals formula for order creation and every edit.

// AU prices include GST, so GST is extracted (price / 11), never added.
const GST_DIVISOR = 11;

/** subtotal, tax_amount and total in cents from items (cents) and shipping. */
function computeOrderTotals(items, { shippingCost = 0, orderDiscount = 0 } = {}) {
  const subtotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity - (i.discount_amount || 0)), 0);
  return {
    subtotal,
    tax_amount: Math.round(subtotal / GST_DIVISOR),
    total: subtotal - orderDiscount + shippingCost,
  };
}

module.exports = { computeOrderTotals, GST_DIVISOR };
