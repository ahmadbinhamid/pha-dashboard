import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Order, OrderDetail } from "@/types/orders";

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  channel?: string;
}

export const getOrders = async (params: OrderListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Order>>>("/order", { params });
  return data;
};

export const getOrderDetail = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<OrderDetail>>(`/order/${id}/detail`);
  return data;
};
