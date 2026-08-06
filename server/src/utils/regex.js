// utils/regex.js

// Escapes regex metacharacters so untrusted input can't alter the pattern's
// meaning or trigger catastrophic backtracking (ReDoS) when interpolated
// into a `new RegExp(...)` built from a search query string.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches a word regardless of internal spacing, either direction — "tail
// light" written as one token in the query ("taillight") still finds a
// field stored WITH a space ("Tail Light"), and vice versa. Built by
// stripping whitespace from the word, then interposing an optional `\s*`
// between every remaining character. `\s*` can always match zero
// characters, so this is a strict superset of a plain literal-substring
// match — never a regression for words that already matched exactly.
function buildSpacingFlexibleRegex(word) {
  const chars = Array.from(String(word).replace(/\s+/g, ""));
  return new RegExp(chars.map((c) => escapeRegex(c)).join("\\s*"), "i");
}

// "Any word matches" search: splits the query on whitespace and returns one
// {field: RegExp} condition per (word, field) pair for the caller to OR
// together. Previously every search box here matched the query as ONE
// literal substring, so searching "ran rover" would never match
// "RANGE ROVER VELAR L560 GRILLE 2017 TO 2023 LR143275" — only an exact
// "ran rover" substring would. Splitting on words means any single word
// (partial, case-insensitive, spacing-flexible) found in any of the given
// fields is enough — "ran", "rover", "2017", and "grille" all independently
// match that title, and "taillight" independently matches a "Tail Light"
// title/field the same way.
//
// This is a Mongo regex scan, not an indexed lookup — fine at the scale
// every current search box here operates at (a single tenant's own orders/
// customers/inventory/listings), but it does NOT scale the way a real
// inverted-index search engine would for a large, multi-tenant-wide catalog.
// Product search uses Typesense for exactly that reason — see
// services/search/product.search.service.js.
function buildWordSearchOr(fields, searchText) {
  const words = String(searchText || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const conditions = [];
  for (const word of words) {
    const re = buildSpacingFlexibleRegex(word);
    for (const field of fields) {
      conditions.push({ [field]: re });
    }
  }
  return conditions;
}

module.exports = { escapeRegex, buildWordSearchOr };
