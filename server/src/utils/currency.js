// utils/currency.js

// Formats integer cents (GST-inclusive AU convention) for human-facing strings; never interpolate raw cents.
function formatCentsAsDollars(cents) {
  return `A$${(cents / 100).toFixed(2)}`;
}

module.exports = { formatCentsAsDollars };
