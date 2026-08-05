// utils/currency.js

// Every money field in this codebase is stored as integer cents (GST-inclusive,
// AU retail convention — see Order.js's own comment). Anywhere a cents value
// ends up in a human-facing string (error messages, emails), it must go
// through this, not be interpolated raw — an unformatted `5300` reads as a
// nonsense number next to a `$53.00` total shown elsewhere in the same UI.
function formatCentsAsDollars(cents) {
  return `A$${(cents / 100).toFixed(2)}`;
}

module.exports = { formatCentsAsDollars };
