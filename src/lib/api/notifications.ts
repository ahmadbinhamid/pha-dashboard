import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  NotificationCategory,
  NotificationListParams,
  NotificationListResponse,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from "@/types/notification";

export const getNotifications = async (params: NotificationListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<NotificationListResponse>>("/notification", { params });
  return data;
};

export const markNotificationRead = async (id: string) => {
  const { data } = await apiClient.patch<BeResponse<null>>(`/notification/${id}/read`);
  return data;
};

export const markAllNotificationsRead = async (category?: NotificationCategory) => {
  // No body: axios would send null as "null", which strict express.json rejects.
  const { data } = await apiClient.patch<BeResponse<null>>("/notification/read-all", undefined, {
    params: { category },
  });
  return data;
};

export const getNotificationPreferences = async () => {
  const { data } = await apiClient.get<BeResponse<NotificationPreferences>>("/notification/preferences");
  return data;
};

export const updateNotificationPreferences = async (update: NotificationPreferencesUpdate) => {
  const { data } = await apiClient.put<BeResponse<NotificationPreferences>>("/notification/preferences", update);
  return data;
};
