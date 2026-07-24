// constants/payment.constants.js

// How the payment is *processed* — Stripe means the API/webhook is the
// source of truth; manual means a staff member typed in what they collected.
// Only ever these two values; see PAYMENT_METHOD for the human-facing detail.
const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: "stripe",
  MANUAL: "manual",
});

// How the customer actually paid, for manual (provider = "manual") payments
// only — null/not applicable for Stripe, which is always a card. Kept
// separate from PAYMENT_PROVIDER so adding a new offline method never means
// touching the provider enum (and everything that switches on it).
const PAYMENT_METHOD = Object.freeze({
  CASH: "cash",
  ONLINE_TRANSFER: "online_transfer",
});

// The three choices staff see when creating a manual order — the first two
// map straight to PAYMENT_METHOD (money already collected); "payment_link"
// is not a PAYMENT_METHOD at all, it means "collect nothing now, generate a
// Stripe Checkout link instead" (see stripe.payment.service.js#createPaymentLinkForOrder).
const ORDER_PAYMENT_CHOICE = Object.freeze({
  CASH: PAYMENT_METHOD.CASH,
  ONLINE_TRANSFER: PAYMENT_METHOD.ONLINE_TRANSFER,
  PAYMENT_LINK: "payment_link",
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

module.exports = { PAYMENT_PROVIDER, PAYMENT_METHOD, ORDER_PAYMENT_CHOICE, PAYMENT_STATUS };
