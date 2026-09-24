import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { ChannelSummary, ChannelSyncLog, ChannelSyncLogStatus } from "@/types/channel";

// Every adapter's manifest plus this tenant's connection/health.
export const getChannels = async () => {
  const { data } = await apiClient.get<BeResponse<ChannelSummary[]>>("/channels");
  return data;
};

export interface ChannelLogParams {
  entity_id?: string;
  status?: ChannelSyncLogStatus;
  page?: number;
  limit?: number;
}

export const getChannelLogs = async (platform: string, params: ChannelLogParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<ChannelSyncLog>>>(`/channels/${platform}/logs`, { params });
  return data;
};

// Re-enqueues the listing behind a failed log row, bypassing the sync debounce.
export const retryChannelLog = async (platform: string, logId: string) => {
  const { data } = await apiClient.post<BeResponse<{ requeued: boolean; listingId: string }>>(
    `/channels/${platform}/retry/${logId}`,
  );
  return data;
};
