// constants/company.constants.js

// Mirrors the storefront's constants/checkout.ts COMPANY_INFO — kept as a
// separate copy since the two are independent apps with no shared package.
const COMPANY_INFO = Object.freeze({
  name: "Parts Hub Australia",
  abn: "45 678 910 112",
  email: "support@partshub.com.au",
});

const PICKUP_LOCATION = Object.freeze({
  name: "Parts Hub Australia",
  address: "34 Killara Road, Campbellfield VIC 3061",
  country: "Australia",
  tradingHours: Object.freeze(["Monday – Friday: 8:30 AM – 5:00 PM", "Saturday: 9:00 AM – 1:00 PM"]),
});

const INVOICE_NOTE = "Please ensure installation is performed by a certified technician to maintain fitment guarantee.";

module.exports = { COMPANY_INFO, PICKUP_LOCATION, INVOICE_NOTE };
