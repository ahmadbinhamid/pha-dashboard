import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  GoogleConnectUrlResponse,
  GoogleAccountsResponse,
  GoogleCompleteConnectPayload,
} from "@/types/googleSettings";

// Returns Google's hosted consent-screen URL; navigated directly (window.location.href), mirroring getEbayConnectUrl. No params: consent happens before a Merchant Center account is chosen (google.controller.js#getConnectUrl).
export const getGoogleConnectUrl = async () => {
  const { data } = await apiClient.get<BeResponse<GoogleConnectUrlResponse>>("/google/oauth/connect-url");
  return data;
};

// Called after landing back with ?google_connect=choose_account — the Merchant Center accounts this tenant's token can access, for the picker.
export const getGoogleAccounts = async () => {
  const { data } = await apiClient.get<BeResponse<GoogleAccountsResponse>>("/google/oauth/accounts");
  return data;
};

// Finishes the connect flow once the tenant has picked/typed a Merchant Center account and confirmed feed settings.
export const completeGoogleConnect = async (payload: GoogleCompleteConnectPayload) => {
  const { data } = await apiClient.post<BeResponse<{ connected: boolean }>>("/google/oauth/complete", payload);
  return data;
};
