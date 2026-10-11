// utils/url.js

// URL parse, not startsWith, so a value merely containing https:// fails.
function isAbsoluteHttpsUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

module.exports = { isAbsoluteHttpsUrl };
