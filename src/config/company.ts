// Mirrors the storefront's constants/checkout.ts COMPANY_INFO — kept as a
// separate copy since the two are independent apps with no shared package.
export const COMPANY_INFO = {
  name: "Parts Hub Australia",
  abn: "82 698 225 464",
  phone: "03 9357313",
  email: "sales@partshubaustralia.com.au",
};

// Not yet supplied — the invoice renders this section with "—" placeholders
// until these are filled in, rather than shipping fabricated account
// details on a real customer-facing document.
export const BANK_DETAILS = {
  bankName: "",
  accountName: "",
  bsb: "",
  accountNumber: "",
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

// Mirrors the server's WARRANTY_TEXT/LEGAL_DISCLAIMER_TEXT — shown in the
// dashboard tax invoice's footer.
export const WARRANTY_TEXT =
  "All parts supplied by Parts Hub Australia carry a minimum 03-month warranty from the date of purchase. Items may be returned within 30 days of receipt if in original, unopened packaging. A 15% restocking fee may apply to change-of-mind returns.";
export const LEGAL_DISCLAIMER_TEXT =
  "Please ensure all parts are fitted by a certified mechanic to maintain warranty validity. Parts Hub Australia is not liable for labor costs associated with part failure unless pre-authorized in writing.";
