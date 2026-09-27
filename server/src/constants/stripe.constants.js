// constants/stripe.constants.js

// Pinned so a Stripe account-level API version change can't silently alter response shapes.
// Bump deliberately, matching whatever version the installed `stripe` package was generated against.
const STRIPE_API_VERSION = "2026-06-24.dahlia";

module.exports = { STRIPE_API_VERSION };
