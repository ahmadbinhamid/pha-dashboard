// utils/regex.js

// Escapes regex metacharacters so untrusted input can't alter the pattern's
// meaning or trigger catastrophic backtracking (ReDoS) when interpolated
// into a `new RegExp(...)` built from a search query string.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "Any word matches" search: splits the query on whitespace and returns one
// {field: RegExp} condition per (word, field) pair for the caller to OR
// together. Previously every search box here matched the query as ONE
// literal substring, so searching "ran rover" would never match
// "RANGE ROVER VELAR L560 GRILLE 2017 TO 2023 LR143275" — only an exact
// "ran rover" substring would. Splitting on words means any single word
// (partial, case-insensitive) found in any of the given fields is enough —
// "ran", "rover", "2017", and "grille" all independently match that title.
function buildWordSearchOr(fields, searchText) {
  const words = String(searchText || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const conditions = [];
  for (const word of words) {
    const re = new RegExp(escapeRegex(word), "i");
    for (const field of fields) {
      conditions.push({ [field]: re });
    }
  }
  return conditions;
}

module.exports = { escapeRegex, buildWordSearchOr };
