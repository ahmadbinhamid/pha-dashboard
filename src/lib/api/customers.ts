import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Customer, CustomerDetail } from "@/types/customer";
import type { OrderAddress } from "@/types/orders";

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CustomerPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  shipping_address?: OrderAddress | null;
  billing_address?: OrderAddress | null;
}

export const getCustomers = async (params: CustomerListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Customer>>>("/customer", { params });
  return data;
};

export const getCustomer = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<CustomerDetail>>(`/customer/${id}`);
  return data;
};

export const createCustomer = async (payload: CustomerPayload) => {
  const { data } = await apiClient.post<BeResponse<Customer>>("/customer", payload);
  return data;
};

export const updateCustomer = async (id: string, payload: CustomerPayload) => {
  const { data } = await apiClient.put<BeResponse<Customer>>(`/customer/${id}`, payload);
  return data;
};

export const deleteCustomer = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/customer/${id}`);
  return data;
};
