// utils/orderVisibility.js
// Query filters deciding which orders staff-facing lists and stats count.

const { ORDER_CHANNEL, ORDER_PAYMENT_STATUS } = require("../constants/order.constants");

// Unpaid storefront orders are checkout attempts, not sales, until Stripe pays.
function excludeAbandonedCheckouts() {
  return { $nor: [{ channel: ORDER_CHANNEL.STOREFRONT, payment_status: ORDER_PAYMENT_STATUS.PENDING_PAYMENT }] };
}

module.exports = { excludeAbandonedCheckouts };
