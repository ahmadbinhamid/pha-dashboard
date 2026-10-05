// constants/stripe.constants.js

// Pinned to the SDK's version so an account upgrade can't reshape replies.
const STRIPE_API_VERSION = "2026-06-24.dahlia";

// Live intent states that mean money moved or is moving: never edit under them.
const INTENT_STATUSES_BLOCKING_EDIT = Object.freeze(["succeeded", "processing", "requires_capture"]);
// States the customer hasn't paid in yet; cancelling closes them for good.
const INTENT_STATUSES_CANCELLABLE = Object.freeze(["requires_payment_method", "requires_confirmation", "requires_action"]);

module.exports = { STRIPE_API_VERSION, INTENT_STATUSES_BLOCKING_EDIT, INTENT_STATUSES_CANCELLABLE };
