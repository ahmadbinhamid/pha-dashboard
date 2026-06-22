import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { EbaySettings, EbayStatus } from "@/types/product";

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
