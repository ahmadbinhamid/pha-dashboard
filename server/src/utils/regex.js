// utils/regex.js

// Escapes metachars so untrusted input can't inject patterns or trigger ReDoS.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ignores internal spacing either way, e.g. "taillight" ~ "Tail Light".
function buildSpacingFlexibleRegex(word) {
  const chars = Array.from(String(word).replace(/\s+/g, ""));
  return new RegExp(chars.map((c) => escapeRegex(c)).join("\\s*"), "i");
}

// Any-word OR search over fields; an unindexed scan, Typesense covers scale.
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

// Whole-value, case-insensitive match, e.g. "honda" matches "Honda".
function exactMatchRegex(value) {
  return new RegExp(`^${escapeRegex(String(value).trim())}$`, "i");
}

module.exports = { escapeRegex, buildWordSearchOr, exactMatchRegex };
