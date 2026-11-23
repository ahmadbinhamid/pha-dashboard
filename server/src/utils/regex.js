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

function splitSearchWords(searchText) {
  return String(searchText || "").trim().split(/\s+/).filter(Boolean);
}

// Any-word OR search over fields; an unindexed scan, Typesense covers scale.
function buildWordSearchOr(fields, searchText) {
  const words = splitSearchWords(searchText);
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

// Every word must hit some field; extraForWord adds per-word $or branches.
function buildAllWordsSearchAnd(fields, searchText, extraForWord = () => []) {
  return splitSearchWords(searchText).map((word, index) => {
    const re = buildSpacingFlexibleRegex(word);
    return { $or: [...fields.map((field) => ({ [field]: re })), ...extraForWord(word, index)] };
  });
}

// Whole-value, case-insensitive match, e.g. "honda" matches "Honda".
function exactMatchRegex(value) {
  return new RegExp(`^${escapeRegex(String(value).trim())}$`, "i");
}

module.exports = {
  escapeRegex,
  splitSearchWords,
  buildSpacingFlexibleRegex,
  buildWordSearchOr,
  buildAllWordsSearchAnd,
  exactMatchRegex,
};
