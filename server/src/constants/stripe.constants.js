// constants/stripe.constants.js

// Pinned explicitly so a Stripe account-level API version change can never
// silently alter response shapes (e.g. charges.data[] vs latest_charge) out
// from under this code. Bump deliberately, not implicitly — and when you do,
// match whatever version the installed `stripe` package was generated
// against (node_modules/stripe/cjs/apiVersion.js), since that's the version
// its type definitions and object shapes actually guarantee.
const STRIPE_API_VERSION = "2026-06-24.dahlia";

module.exports = { STRIPE_API_VERSION };
