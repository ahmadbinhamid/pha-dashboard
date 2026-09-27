import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { ShippingSettings, UpdateShippingSettingsPayload } from "@/types/shipping";

export const SHIPPING_SETTINGS_QUERY_KEY = ["shipping-settings"] as const;

export const getShippingSettings = async () => {
  const { data } = await apiClient.get<BeResponse<ShippingSettings>>("/shipping/settings");
  return data;
};

export const updateShippingSettings = async (payload: UpdateShippingSettingsPayload) => {
  const { data } = await apiClient.put<BeResponse<ShippingSettings>>("/shipping/settings", payload);
  return data;
};

export const testShippingConnection = async () => {
  const { data } = await apiClient.post<BeResponse<{ ok: boolean }>>("/shipping/settings/test");
  return data;
};
