import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Business, BusinessDetail, BusinessListItem } from "@/types/business";

export const BUSINESSES_QUERY_KEY = ["businesses"] as const;

export interface BusinessListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface RepresentativePayload {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface CreateBusinessPayload {
  name: string;
  representatives: RepresentativePayload[];
}

export const getBusinessOptions = async () => {
  const { data } = await apiClient.get<BeResponse<Business[]>>("/business/options");
  return data;
};

export const getBusinesses = async (params: BusinessListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<BusinessListItem>>>("/business", { params });
  return data;
};

export const getBusiness = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<BusinessDetail>>(`/business/${id}`);
  return data;
};

export const createBusiness = async (payload: CreateBusinessPayload) => {
  const { data } = await apiClient.post<BeResponse<BusinessDetail>>("/business", payload);
  return data;
};

export const updateBusiness = async (id: string, name: string) => {
  const { data } = await apiClient.put<BeResponse<Business>>(`/business/${id}`, { name });
  return data;
};

export const deleteBusiness = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/business/${id}`);
  return data;
};
