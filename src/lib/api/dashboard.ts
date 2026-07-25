import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  DashboardStats,
  OrderVolumePoint,
  ChannelHealth,
  ActivityEvent,
  CriticalStockItem,
} from "@/types/dashboard";

export const getDashboardStats = async () => {
  const { data } = await apiClient.get<BeResponse<DashboardStats>>("/dashboard/stats");
  return data;
};

export const getActiveChannels = async () => {
  const { data } = await apiClient.get<BeResponse<ChannelHealth[]>>("/dashboard/channels");
  return data;
};

export const getOrderVolume = async (days = 7) => {
  const { data } = await apiClient.get<BeResponse<OrderVolumePoint[]>>("/dashboard/order-volume", {
    params: { days },
  });
  return data;
};

export const getRecentActivity = async (limit = 10) => {
  const { data } = await apiClient.get<BeResponse<ActivityEvent[]>>("/dashboard/activity", {
    params: { limit },
  });
  return data;
};

export const getCriticalStock = async (limit = 10) => {
  const { data } = await apiClient.get<BeResponse<CriticalStockItem[]>>("/dashboard/critical-stock", {
    params: { limit },
  });
  return data;
};
