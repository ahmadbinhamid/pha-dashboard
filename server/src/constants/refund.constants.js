// constants/refund.constants.js

// refund-redesign-spec.md §1.4 — every existing value is unchanged (this is
// a strict superset, not a rename), so no migration mapping is needed for
// historical Refund docs: CUSTOMER_RETURN, WRONG_ITEM_SENT,
// DAMAGED_ON_ARRIVAL, GOODWILL, PRICE_ADJUSTMENT are the only additions.
const REFUND_REASON = Object.freeze({
  // Goods physically returned — restock defaults ON in the UI (see
  // RESTOCK_DEFAULT_REASONS below). UI-default only; the server never infers
  // restock from reason (§3.5).
  CUSTOMER_RETURN: "customer_return",
  ORDER_CANCELLED: "order_cancelled",
  WRONG_ITEM_SENT: "wrong_item_sent",
  // Goods not returned or unsellable — restock defaults OFF in the UI.
  DAMAGED_ON_ARRIVAL: "damaged_on_arrival",
  CUSTOMER_REQUEST: "customer_request",
  GOODWILL: "goodwill",
  PRICE_ADJUSTMENT: "price_adjustment",
  DUPLICATE_PAYMENT: "duplicate_payment",
  FRAUD_SUSPECTED: "fraud_suspected",
  PAYMENT_ERROR: "payment_error",
  OTHER: "other", // used when reconciling a refund issued directly from the Stripe dashboard
});

// UI default only — drives which reasons pre-check the restock checkbox when
// a staff member opens the refund dialog. The server never restocks based on
// reason; restock is driven solely by the per-line boolean actually submitted
// (§3.5) — an admin who unchecks restock on an order-cancelled refund must
// not get a restock.
const RESTOCK_DEFAULT_REASONS = new Set([
  REFUND_REASON.CUSTOMER_RETURN,
  REFUND_REASON.ORDER_CANCELLED,
  REFUND_REASON.WRONG_ITEM_SENT,
]);

// PROCESSING/CANCELED/VOIDED are additive (§1.4) — existing code comparing
// against PENDING/SUCCEEDED/FAILED is unaffected; nothing sets the three new
// values until the orchestration rewrite (§3.7/§3.8) starts using them.
const REFUND_STATUS = Object.freeze({
  PENDING: "pending", // record written, money not yet moved
  PROCESSING: "processing", // Stripe accepted, awaiting webhook confirmation
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled", // Stripe refund canceled before settling
  VOIDED: "voided", // reversed by an admin after succeeding — never hard-deleted
});

module.exports = { REFUND_REASON, RESTOCK_DEFAULT_REASONS, REFUND_STATUS };
