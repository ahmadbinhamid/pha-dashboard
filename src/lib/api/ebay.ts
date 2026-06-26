import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { EbaySettings, EbayStatus } from "@/types/product";
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

export const updateEbaySettings = async (payload: Partial<EbaySettings>) => {
  const { data } = await apiClient.put<BeResponse<EbaySettings>>(
    "/ebay/settings",
    payload,
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
