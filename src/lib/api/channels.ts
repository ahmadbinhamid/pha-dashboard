import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { ChannelSummary } from "@/types/channel";

// GET /api/v1/channels: every registered adapter's manifest + this tenant's connection/health (services/marketplace/channel.service.js#listChannelsForTenant), generic across platforms.
export const getChannels = async () => {
  const { data } = await apiClient.get<BeResponse<ChannelSummary[]>>("/channels");
  return data;
};
