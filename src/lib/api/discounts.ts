import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Discount, DiscountDetail, DiscountPayload } from "@/types/discount";

export const DISCOUNTS_QUERY_KEY = ["discounts"] as const;
export const discountQueryKey = (id: string) => [...DISCOUNTS_QUERY_KEY, id] as const;

export const getDiscounts = async () => {
  const { data } = await apiClient.get<BeResponse<Discount[]>>("/discounts");
  return data;
};

export const getDiscount = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<DiscountDetail>>(`/discounts/${id}`);
  return data;
};

export const createDiscount = async (payload: DiscountPayload) => {
  const { data } = await apiClient.post<BeResponse<Discount>>("/discounts", payload);
  return data;
};

export const updateDiscount = async (id: string, payload: DiscountPayload) => {
  const { data } = await apiClient.patch<BeResponse<Discount>>(`/discounts/${id}`, payload);
  return data;
};

export const deleteDiscount = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<{ _id: string }>>(`/discounts/${id}`);
  return data;
};

