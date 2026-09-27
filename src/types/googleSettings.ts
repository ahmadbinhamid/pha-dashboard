// Google Shopping connect flow, mirroring ebaySettings.ts's shape. Consent happens first with no merchant fields up front (channel-architecture.md §9); the tenant picks a Merchant Center account only after, via GoogleConnectAccount/GoogleAccountsResponse/GoogleCompleteConnectPayload below.

export interface GoogleConnectUrlResponse {
  url: string;
}

export interface GoogleConnectAccount {
  accountId: string;
  accountName: string | null;
}

export interface GoogleAccountsResponse {
  accounts: GoogleConnectAccount[];
  // false when accounts.list wasn't usable for this token (google.controller.js#getAccounts) — UI falls back to a manual ID field instead of a dropdown.
  listSupported: boolean;
  message?: string;
}

export interface GoogleCompleteConnectPayload {
  merchantId: string;
  targetCountry: string;
  // Optional — google.controller.js#completeConnect defaults these server-side when omitted.
  feedLabel?: string;
  contentLanguage?: string;
}
