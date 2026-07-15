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
});

module.exports = { PAYMENT_PROVIDER, PAYMENT_STATUS };
