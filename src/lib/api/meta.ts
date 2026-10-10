import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { MetaBusinessesResponse, MetaCompleteConnectPayload, MetaConnectUrlResponse } from "@/types/metaSettings";

// Facebook Login for Business URL; navigated to directly.
export const getMetaConnectUrl = async () => {
  const { data } = await apiClient.get<BeResponse<MetaConnectUrlResponse>>("/meta/oauth/connect-url");
  return data;
};

// After ?meta_connect=choose_catalog: businesses this sign-in reaches.
export const getMetaBusinesses = async () => {
  const { data } = await apiClient.get<BeResponse<MetaBusinessesResponse>>("/meta/oauth/businesses");
  return data;
};

export const completeMetaConnect = async (payload: MetaCompleteConnectPayload) => {
  const { data } = await apiClient.post<BeResponse<{ connected: boolean }>>("/meta/oauth/complete", payload);
  return data;
};
