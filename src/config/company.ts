// Mirrors the storefront's constants/checkout.ts COMPANY_INFO — kept as a
// separate copy since the two are independent apps with no shared package.
export const COMPANY_INFO = {
  name: "Parts Hub Australia",
  abn: "45 678 910 112",
  email: "support@partshub.com.au",
};

// Mirrors the storefront's PICKUP_LOCATION and the server's invoice PDF —
// used by the order-detail page's printable invoice.
export const PICKUP_LOCATION = {
  address: "34 Killara Road, Campbellfield VIC 3061",
  country: "Australia",
};

// Mirrors the server's INVOICE_NOTE (constants/company.constants.js).
export const INVOICE_NOTE =
  "Please ensure installation is performed by a certified technician to maintain fitment guarantee.";
