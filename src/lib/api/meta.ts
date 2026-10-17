import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { MetaCatalogsResponse, MetaCompleteConnectPayload, MetaConnectUrlResponse } from "@/types/metaSettings";

// Facebook Login for Business URL; navigated to directly.
export const getMetaConnectUrl = async () => {
  const { data } = await apiClient.get<BeResponse<MetaConnectUrlResponse>>("/meta/oauth/connect-url");
  return data;
};

// After ?meta_connect=choose_catalog: catalogs this sign-in was granted.
export const getMetaCatalogs = async () => {
  const { data } = await apiClient.get<BeResponse<MetaCatalogsResponse>>("/meta/oauth/catalogs");
  return data;
};

export const completeMetaConnect = async (payload: MetaCompleteConnectPayload) => {
  const { data } = await apiClient.post<BeResponse<{ connected: boolean }>>("/meta/oauth/complete", payload);
  return data;
};

// Revokes Meta's token and deletes the stored connection.
export const disconnectMeta = async () => {
  const { data } = await apiClient.post<BeResponse<{ disconnected: boolean }>>("/meta/oauth/disconnect");
  return data;
};
