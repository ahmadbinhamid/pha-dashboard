// constants/refund.constants.js

// A strict superset of the prior values, so no migration mapping is needed for historical docs.
const REFUND_REASON = Object.freeze({
  // Goods physically returned; restock defaults ON in the UI only (server never infers restock).
  CUSTOMER_RETURN: "customer_return",
  ORDER_CANCELLED: "order_cancelled",
  WRONG_ITEM_SENT: "wrong_item_sent",
  // Goods not returned or unsellable; restock defaults OFF in the UI.
  DAMAGED_ON_ARRIVAL: "damaged_on_arrival",
  CUSTOMER_REQUEST: "customer_request",
  GOODWILL: "goodwill",
  PRICE_ADJUSTMENT: "price_adjustment",
  DUPLICATE_PAYMENT: "duplicate_payment",
  FRAUD_SUSPECTED: "fraud_suspected",
  PAYMENT_ERROR: "payment_error",
  OTHER: "other", // used when reconciling a refund issued directly from the Stripe dashboard
});

// UI default only, pre-checking the restock checkbox; the server never restocks based on
// reason — restock is driven solely by the per-line boolean actually submitted.
const RESTOCK_DEFAULT_REASONS = new Set([
  REFUND_REASON.CUSTOMER_RETURN,
  REFUND_REASON.ORDER_CANCELLED,
  REFUND_REASON.WRONG_ITEM_SENT,
]);

// PROCESSING/CANCELED/VOIDED are additive; existing code comparing against PENDING/SUCCEEDED/FAILED is unaffected.
const REFUND_STATUS = Object.freeze({
  PENDING: "pending", // record written, money not yet moved
  PROCESSING: "processing", // Stripe accepted, awaiting webhook confirmation
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled", // Stripe refund canceled before settling
  VOIDED: "voided", // reversed by an admin after succeeding — never hard-deleted
});

module.exports = { REFUND_REASON, RESTOCK_DEFAULT_REASONS, REFUND_STATUS };
