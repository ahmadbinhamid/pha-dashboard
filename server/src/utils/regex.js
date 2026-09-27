// utils/regex.js

// Escapes regex metachars so untrusted input can't inject patterns or trigger ReDoS.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches a word ignoring internal spacing either direction (e.g. "taillight" ~ "Tail Light").
function buildSpacingFlexibleRegex(word) {
  const chars = Array.from(String(word).replace(/\s+/g, ""));
  return new RegExp(chars.map((c) => escapeRegex(c)).join("\\s*"), "i");
}

// "Any word matches" OR search across fields; Mongo regex scan, not indexed — Typesense handles product search at scale.
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
