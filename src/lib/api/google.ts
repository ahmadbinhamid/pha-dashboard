import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { GoogleConnectUrlParams, GoogleConnectUrlResponse } from "@/types/googleSettings";

// Returns Google's hosted consent-screen URL — the caller navigates the
// browser there directly (window.location.href), it's not fetched via XHR,
// mirroring getEbayConnectUrl. Unlike eBay's connect-url call, Google's also
// requires the tenant's Merchant Center id + feed settings up front (see
// controllers/google.controller.js#getConnectUrl).
export const getGoogleConnectUrl = async (params: GoogleConnectUrlParams) => {
  const { data } = await apiClient.get<BeResponse<GoogleConnectUrlResponse>>("/google/oauth/connect-url", {
    params,
  });
  return data;
};
