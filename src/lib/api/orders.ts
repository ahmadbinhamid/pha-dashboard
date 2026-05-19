import type { ApiResponse, PaginatedResponse } from "./base";
import type { Order, SaleType, FulfilmentType } from "@/types";

export type OrdersListParams = {
  page?: number;
  search?: string;
  status?: string;
  channel?: string;
};

export type CreateOrderInput = {
  customer: { name: string; email: string; phone?: string; address?: string };
  saleType: SaleType;
  fulfilment: FulfilmentType;
  lines: Array<{ productId: string; sku: string; title: string; qty: number; unitPriceInclGst: number }>;
  shippingInclGst?: number;
  discountInclGst?: number;
  notes?: string;
};

// Stubs — implement once BE is ready
export async function getOrders(
  _params: OrdersListParams = {},
): Promise<ApiResponse<PaginatedResponse<Order>>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function createOrder(
  _input: CreateOrderInput,
): Promise<ApiResponse<{ order: Order }>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function updateOrderStatus(
  _id: string,
  _status: Order["status"],
): Promise<ApiResponse<{ order: Order }>> {
  throw new Error("Not implemented — BE not finalized");
}
