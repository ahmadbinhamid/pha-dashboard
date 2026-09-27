// utils/addressFormat.js

// Strips eBay's internal "ebay:<code>, " address prefix; no-op elsewhere, safe to call unconditionally.
function stripEbayAddressPrefix(address) {
  return String(address || "").replace(/^ebay:[^,]*,\s*/i, "");
}

module.exports = { stripEbayAddressPrefix };
