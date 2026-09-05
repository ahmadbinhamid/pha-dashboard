// Google Shopping (Merchant API) connect flow — mirrors types/ebaySettings.ts's
// shape. Unlike eBay, Google's OAuth consent has no equivalent of "one
// application, tenant just authorizes it": a Merchant Center account id and
// feed settings are tenant-chosen inputs the backend needs up front (see
// services/google/google.oauth.service.js#buildConsentUrl's own comment),
// not something OAuth hands back — so there is no GET /google/settings to
// pre-fill from yet, only the connect-url call itself.

export interface GoogleConnectUrlParams {
  merchantId: string;
  feedLabel: string;
  contentLanguage: string;
  targetCountry: string;
}

export interface GoogleConnectUrlResponse {
  url: string;
}
