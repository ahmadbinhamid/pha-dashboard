import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  InventoryRecord,
  InventoryHistoryRecord,
  InventorySettings,
} from "@/types/inventory";

export interface InventoryListParams {
  page?: number;
  search?: string;
  location?: string;
  product?: string;
  variant?: string;
  limit?: number;
}

export interface InventoryListData {
  items: InventoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getInventory = async (params: InventoryListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<InventoryListData>>(
    "/inventory",
    { params },
  );
  return data;
};

export const adjustStock = async (
  inventoryId: string,
  payload: { adjustment: number; reason?: string; type?: string },
) => {
  const { data } = await apiClient.post<BeResponse<InventoryRecord>>(
    `/inventory/${inventoryId}/adjust`,
    payload,
  );
  return data;
};

export const setStock = async (
  inventoryId: string,
  payload: { stock_count: number; reason?: string },
) => {
  const { data } = await apiClient.post<BeResponse<InventoryRecord>>(
    `/inventory/${inventoryId}/set`,
    payload,
  );
  return data;
};

export const getInventoryHistory = async (inventoryId: string) => {
  const { data } = await apiClient.get<BeResponse<InventoryHistoryRecord[]>>(
    `/inventory/${inventoryId}/history`,
  );
  return data;
};

export const getInventorySettings = async () => {
  const { data } = await apiClient.get<BeResponse<InventorySettings>>(
    "/inventory/settings",
  );
  return data;
};

export const updateInventorySettings = async (
  payload: Partial<InventorySettings>,
) => {
  const { data } = await apiClient.put<BeResponse<InventorySettings>>(
    "/inventory/settings",
    payload,
  );
  return data;
};

export const ensureInventoryRecord = async (payload: {
  product: string;
  location: string;
  variant?: string | null;
}) => {
  const { data } = await apiClient.post<BeResponse<InventoryRecord>>(
    "/inventory/ensure",
    payload,
  );
  return data;
};
