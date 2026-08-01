import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { TenantSettings, UpdateTenantSettingsPayload, StripeConnectStatus } from "@/types/tenantSettings";

export const getTenantSettings = async () => {
  const { data } = await apiClient.get<BeResponse<TenantSettings>>("/tenant-settings");
  return data;
};

export const updateTenantSettings = async (payload: UpdateTenantSettingsPayload) => {
  const { data } = await apiClient.patch<BeResponse<TenantSettings>>("/tenant-settings", payload);
  return data;
};

export const connectStripeAccount = async () => {
  const { data } = await apiClient.post<BeResponse<TenantSettings>>("/tenant-settings/stripe/connect");
  return data;
};

export const createStripeAccountSession = async () => {
  const { data } = await apiClient.post<BeResponse<{ client_secret: string }>>(
    "/tenant-settings/stripe/account-session",
  );
  return data;
};

export const getStripeConnectStatus = async () => {
  const { data } = await apiClient.get<BeResponse<StripeConnectStatus>>("/tenant-settings/stripe/status");
  return data;
};
