// constants/payment.constants.js

const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: "stripe",
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  REQUIRES_ACTION: "requires_action",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
  // Funds were actually captured by Stripe but the amount/currency didn't
  // match what we billed for — distinct from FAILED (no money moved) so an
  // admin knows to investigate rather than assume the customer wasn't charged.
  MANUAL_REVIEW: "manual_review",
});

module.exports = { PAYMENT_PROVIDER, PAYMENT_STATUS };
