import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { CampaignPreview, EmailDesign } from "@/types/campaign";
import type { Feedback, FeedbackStats, FollowUp, FollowUpPayload } from "@/types/followup";


export const FOLLOW_UPS_QUERY_KEY = ["follow-ups"] as const;
export const followUpQueryKey = (id: string) => [...FOLLOW_UPS_QUERY_KEY, id] as const;
export const FEEDBACK_QUERY_KEY = ["feedback"] as const;

export const getFollowUps = async () => (await apiClient.get<BeResponse<FollowUp[]>>("/campaigns/follow-ups")).data;

export const getFollowUp = async (id: string) => (await apiClient.get<BeResponse<FollowUp>>(`/campaigns/follow-ups/${id}`)).data;

export const createFollowUp = async (payload: FollowUpPayload) =>
  (await apiClient.post<BeResponse<FollowUp>>("/campaigns/follow-ups", payload)).data;

export const updateFollowUp = async (id: string, payload: FollowUpPayload) =>
  (await apiClient.patch<BeResponse<FollowUp>>(`/campaigns/follow-ups/${id}`, payload)).data;

export const setFollowUpEnabled = async (id: string, enabled: boolean) =>
  (await apiClient.post<BeResponse<FollowUp>>(`/campaigns/follow-ups/${id}/enabled`, { enabled })).data;

export const deleteFollowUp = async (id: string) =>
  (await apiClient.delete<BeResponse<{ _id: string }>>(`/campaigns/follow-ups/${id}`)).data;

export const previewFollowUp = async (payload: { design: EmailDesign; subject: string; preheader: string; ask_for_rating?: boolean }) =>
  (await apiClient.post<BeResponse<CampaignPreview>>("/campaigns/follow-ups/preview", payload)).data;

export const getFeedback = async (params: { page: number; limit: number; search?: string; rating?: number; max_rating?: number }) =>
  (await apiClient.get<BeResponse<PaginatedData<Feedback>>>("/campaigns/feedback", { params })).data;

export const getFeedbackStats = async () => (await apiClient.get<BeResponse<FeedbackStats>>("/campaigns/feedback/stats")).data;
