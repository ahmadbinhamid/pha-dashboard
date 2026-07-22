// constants/company.constants.js

// Mirrors the storefront's constants/checkout.ts COMPANY_INFO — kept as a
// separate copy since the two are independent apps with no shared package.
const COMPANY_INFO = Object.freeze({
  name: "Parts Hub Australia",
  abn: "45 678 910 112",
});

const PICKUP_LOCATION = Object.freeze({
  name: "Parts Hub Australia — Melbourne Warehouse",
  address: "123 Performance Way, Melbourne VIC 3000",
});

const INVOICE_NOTE = "Please ensure installation is performed by a certified technician to maintain fitment guarantee.";

module.exports = { COMPANY_INFO, PICKUP_LOCATION, INVOICE_NOTE };
