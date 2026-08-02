import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  TenantSettings,
  UpdateTenantSettingsPayload,
  StripeKeysStatus,
  UpdateStripeKeysPayload,
  SmtpStatus,
  UpdateSmtpCredentialsPayload,
} from "@/types/tenantSettings";

export const getTenantSettings = async () => {
  const { data } = await apiClient.get<BeResponse<TenantSettings>>("/tenant-settings");
  return data;
};

export const updateTenantSettings = async (payload: UpdateTenantSettingsPayload) => {
  const { data } = await apiClient.patch<BeResponse<TenantSettings>>("/tenant-settings", payload);
  return data;
};

export const updateStripeKeys = async (payload: UpdateStripeKeysPayload) => {
  const { data } = await apiClient.put<BeResponse<StripeKeysStatus>>("/tenant-settings/stripe/keys", payload);
  return data;
};

export const getStripeStatus = async () => {
  const { data } = await apiClient.get<BeResponse<StripeKeysStatus>>("/tenant-settings/stripe/status");
  return data;
};

export const updateStripeWebhookSecret = async (webhook_secret: string) => {
  const { data } = await apiClient.put<BeResponse<StripeKeysStatus>>("/tenant-settings/stripe/webhook-secret", {
    webhook_secret,
  });
  return data;
};

export const updateSmtpCredentials = async (payload: UpdateSmtpCredentialsPayload) => {
  const { data } = await apiClient.put<BeResponse<SmtpStatus>>("/tenant-settings/smtp/credentials", payload);
  return data;
};

export const getSmtpStatus = async () => {
  const { data } = await apiClient.get<BeResponse<SmtpStatus>>("/tenant-settings/smtp/status");
  return data;
};
