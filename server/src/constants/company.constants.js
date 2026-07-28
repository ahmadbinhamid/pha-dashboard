// constants/company.constants.js

// Mirrors the storefront's constants/checkout.ts COMPANY_INFO — kept as a
// separate copy since the two are independent apps with no shared package.
const COMPANY_INFO = Object.freeze({
  name: "Parts Hub Australia",
  abn: "82 698 225 464",
  phone: "03 9357313",
  email: "sales@partshubaustralia.com.au",
});

const BANK_DETAILS = Object.freeze({
  bankName: "National Australia Bank",
  accountName: "PARTS HUB AUSTRALIA PTY LTD",
  bsb: "083004",
  accountNumber: "299755132",
});

const PICKUP_LOCATION = Object.freeze({
  name: "Parts Hub Australia",
  address: "34 Killara Road, Campbellfield VIC 3061",
  country: "Australia",
  tradingHours: Object.freeze(["Monday – Friday: 8:30 AM – 5:00 PM", "Saturday: 9:00 AM – 1:00 PM"]),
});

// Shown in the tax invoice PDF footer — mirrors the dashboard's
// config/company.ts WARRANTY_TEXT/LEGAL_DISCLAIMER_TEXT.
const WARRANTY_TEXT =
  "All parts supplied by Parts Hub Australia carry a minimum 03-month warranty from the date of purchase. Items may be returned within 30 days of receipt if in original, unopened packaging. A 15% restocking fee may apply to change-of-mind returns.";
const LEGAL_DISCLAIMER_TEXT =
  "Please ensure all parts are fitted by a certified mechanic to maintain warranty validity. Parts Hub Australia is not liable for labor costs associated with part failure unless pre-authorized in writing.";

module.exports = { COMPANY_INFO, PICKUP_LOCATION, WARRANTY_TEXT, LEGAL_DISCLAIMER_TEXT, BANK_DETAILS };
