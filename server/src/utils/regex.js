// utils/regex.js

// Escapes regex metacharacters so untrusted input can't alter the pattern's
// meaning or trigger catastrophic backtracking (ReDoS) when interpolated
// into a `new RegExp(...)` built from a search query string.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
