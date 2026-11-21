// constants/payment.constants.js

// Stripe: webhook is the source of truth; manual: staff record what they took.
const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: "stripe",
  MANUAL: "manual",
  // eBay collects payment itself; a record only, never charged or refunded here.
  EBAY: "ebay",
});

// Manual payments only; separate so new offline methods skip the provider enum.
const PAYMENT_METHOD = Object.freeze({
  CASH: "cash",
  ONLINE_TRANSFER: "online_transfer",
  EFPOS: "efpos",
});

// payment_link isn't a PAYMENT_METHOD: collect nothing now, send a pay link.
const ORDER_PAYMENT_CHOICE = Object.freeze({
  CASH: PAYMENT_METHOD.CASH,
  ONLINE_TRANSFER: PAYMENT_METHOD.ONLINE_TRANSFER,
  EFPOS: PAYMENT_METHOD.EFPOS,
  PAYMENT_LINK: "payment_link",
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  REQUIRES_ACTION: "requires_action",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
  // Captured but amount/currency mismatched; unlike FAILED, money did move.
  MANUAL_REVIEW: "manual_review",
});

// Stripe buy-now-pay-later types; offered on storefront orders only.
const BNPL_METHODS = Object.freeze(["afterpay_clearpay", "zip"]);

module.exports = { PAYMENT_PROVIDER, PAYMENT_METHOD, ORDER_PAYMENT_CHOICE, PAYMENT_STATUS, BNPL_METHODS };
