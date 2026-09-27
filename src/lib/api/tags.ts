import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { TagImportResult, TagPrintHistoryPage, TagPrintLog, TagPrintSource, TagQueueItem, TagQueueMode, TagStyle } from "@/types/tags";

// Shared React Query keys; history is prefixed so every page invalidates.
export const TAG_QUERY_KEYS = {
  queue: ["tag-queue"],
  history: ["tag-history"],
  style: ["tag-style"],
} as const;

export const getTagQueue = async () => {
  const { data } = await apiClient.get<BeResponse<TagQueueItem[]>>("/tags/queue");
  return data;
};

// No copies: "set" queues the whole stock, "increment" adds one tag.
export const addToTagQueue = async (productId: string, opts: { copies?: number; mode?: TagQueueMode } = {}) => {
  const { data } = await apiClient.post<BeResponse<TagQueueItem>>("/tags/queue", { product_id: productId, ...opts });
  return data;
};

export const importUnprintedTags = async () => {
  const { data } = await apiClient.post<BeResponse<TagImportResult>>("/tags/queue/import-unprinted");
  return data;
};

export const updateTagQueueItem = async (id: string, copies: number) => {
  const { data } = await apiClient.patch<BeResponse<TagQueueItem>>(`/tags/queue/${id}`, { copies });
  return data;
};

export const removeTagQueueItem = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<null>>(`/tags/queue/${id}`);
  return data;
};

export const clearTagQueue = async () => {
  const { data } = await apiClient.delete<BeResponse<{ removed: number }>>("/tags/queue");
  return data;
};

export const recordTagPrint = async (source: TagPrintSource, items: { product_id: string; copies: number }[]) => {
  const { data } = await apiClient.post<BeResponse<TagPrintLog>>("/tags/prints", { source, items });
  return data;
};

export const getTagHistory = async (params: { page: number; limit: number }) => {
  const { data } = await apiClient.get<BeResponse<TagPrintHistoryPage>>("/tags/history", { params });
  return data;
};

export const getTagStyle = async () => {
  const { data } = await apiClient.get<BeResponse<TagStyle>>("/tags/style");
  return data;
};

export const updateTagStyle = async (style: Partial<TagStyle>) => {
  const { data } = await apiClient.put<BeResponse<TagStyle>>("/tags/style", style);
  return data;
};
