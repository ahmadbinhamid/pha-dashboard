// constants/payment.constants.js

// How the payment is processed: Stripe means the API/webhook is the source of truth; manual
// means staff typed in what they collected. See PAYMENT_METHOD for the human-facing detail.
const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: "stripe",
  MANUAL: "manual",
  // eBay collects payment on their end before pushing the order to us; auto-created at import
  // time as a record only, never something we collect or refund through a gateway.
  EBAY: "ebay",
});

// How the customer actually paid, for manual payments only. Kept separate from PAYMENT_PROVIDER
// so adding a new offline method never touches the provider enum.
const PAYMENT_METHOD = Object.freeze({
  CASH: "cash",
  ONLINE_TRANSFER: "online_transfer",
  EFPOS: "efpos",
});

// The three choices staff see creating a manual order; "payment_link" isn't a PAYMENT_METHOD,
// it means collect nothing now and generate a Stripe Checkout link instead.
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
  // Funds were captured but amount/currency mismatched what we billed; distinct from FAILED
  // (no money moved) so an admin investigates rather than assumes no charge.
  MANUAL_REVIEW: "manual_review",
});

module.exports = { PAYMENT_PROVIDER, PAYMENT_METHOD, ORDER_PAYMENT_CHOICE, PAYMENT_STATUS };
