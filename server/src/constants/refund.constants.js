// constants/refund.constants.js

const REFUND_REASON = Object.freeze({
  CUSTOMER_REQUEST: "customer_request",
  DUPLICATE_PAYMENT: "duplicate_payment",
  FRAUD_SUSPECTED: "fraud_suspected",
  PAYMENT_ERROR: "payment_error",
  ORDER_CANCELLED: "order_cancelled",
  OTHER: "other", // used when reconciling a refund issued directly from the Stripe dashboard
});

const REFUND_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
});

module.exports = { REFUND_REASON, REFUND_STATUS };
