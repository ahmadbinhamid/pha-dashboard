// utils/addressFormat.js

// eBay orders store the buyer's masked eBay identifier as a literal
// "ebay:<code>, " prefix on address line 1 (e.g. "ebay:znb2cfa, 26A Lynesta
// Avenue") — useful internally, but meaningless (and unprofessional-
// looking) on a customer-facing invoice/receipt. Strips it when present; a
// no-op on any other address, so it's safe to call unconditionally rather
// than gating it on order.channel === "ebay". The dashboard (React) uses
// the equivalent src/utils/format.ts#stripEbayAddressPrefix for anything it
// renders directly.
function stripEbayAddressPrefix(address) {
  return String(address || "").replace(/^ebay:[^,]*,\s*/i, "");
}

module.exports = { stripEbayAddressPrefix };
