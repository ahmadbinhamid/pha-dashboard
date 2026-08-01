import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { EbaySettings, EbayStatus, UpdateEbaySettingsPayload, EbayConnectUrlResponse } from "@/types/ebaySettings";
import type {
  CategorySuggestionsResponse,
  ConditionPoliciesResponse,
  BusinessPoliciesResponse,
  CategoryAspectsResponse,
} from "@/types/ebay";

export const getEbayStatus = async () => {
  const { data } = await apiClient.get<BeResponse<EbayStatus>>("/ebay/status");
  return data;
};

export const getEbaySettings = async () => {
  const { data } = await apiClient.get<BeResponse<EbaySettings>>("/ebay/settings");
  return data;
};

export const updateEbaySettings = async (payload: UpdateEbaySettingsPayload) => {
  const { data } = await apiClient.put<BeResponse<EbaySettings>>(
    "/ebay/settings",
    payload,
  );
  return data;
};

// Returns eBay's hosted consent-screen URL — the caller navigates the
// browser there directly (window.location.href), it's not fetched via XHR.
export const getEbayConnectUrl = async (sandbox: boolean) => {
  const { data } = await apiClient.get<BeResponse<EbayConnectUrlResponse>>("/ebay/oauth/connect-url", {
    params: { sandbox },
  });
  return data;
};

export const subscribeEbayWebhook = async () => {
  const { data } = await apiClient.post<BeResponse<{ subscriptions: unknown; endpoint: string }>>(
    "/ebay/webhook/subscribe",
  );
  return data;
};

export const getCategorySuggestions = async (q: string) => {
  const { data } = await apiClient.get<BeResponse<CategorySuggestionsResponse>>(
    "/ebay/category-suggestions",
    { params: { q } },
  );
  return data;
};

export const getConditionPolicies = async (categoryId: string) => {
  const { data } = await apiClient.get<BeResponse<ConditionPoliciesResponse>>(
    "/ebay/condition-policies",
    { params: { categoryId } },
  );
  return data;
};

export const getBusinessPolicies = async () => {
  const { data } = await apiClient.get<BeResponse<BusinessPoliciesResponse>>(
    "/ebay/business-policies",
  );
  return data;
};

export const getCategoryAspects = async (categoryId: string) => {
  const { data } = await apiClient.get<BeResponse<CategoryAspectsResponse>>(
    "/ebay/category-aspects",
    { params: { categoryId } },
  );
  return data;
};

