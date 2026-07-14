import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Category } from "@/types/product";

export interface CategoryListParams {
  page?: number;
  limit?: number;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  thumbnail?: string | null;
  parent?: string | null;
  sort_order?: number;
}

export const getCategories = async (params: CategoryListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Category>>>(
    "/category",
    { params },
  );
  return data;
};

export const getCategory = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<Category>>(`/category/${id}`);
  return data;
};

export const createCategory = async (payload: CategoryPayload) => {
  const { data } = await apiClient.post<BeResponse<Category>>(
    "/category",
    payload,
  );
  return data;
};

export const updateCategory = async (id: string, payload: CategoryPayload) => {
  const { data } = await apiClient.put<BeResponse<Category>>(
    `/category/${id}`,
    payload,
  );
  return data;
};

export const deleteCategory = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/category/${id}`);
  return data;
};
