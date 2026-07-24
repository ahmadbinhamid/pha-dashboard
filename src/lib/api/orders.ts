import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Order, OrderAddress, OrderDeliveryMethod, OrderDetail } from "@/types/orders";
import type { OrderPaymentChoice } from "@/types/payment";

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

export interface SendOrderEmailPayload {
  tracking_number?: string;
  carrier_name?: string;
}

export const sendOrderEmail = async (id: string, payload: SendOrderEmailPayload = {}) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${id}/send-email`, payload);
  return data;
};

// ── Manual/in-person orders (POS) ───────────────────────────────────────────

export interface CreateManualOrderItemPayload {
  product: string;
  variant?: string | null;
  quantity: number;
  discount_amount?: number; // dollars
  note?: string | null;
}

export interface CreateManualOrderPayload {
  customer_id: string;
  items: CreateManualOrderItemPayload[];
  delivery_method: OrderDeliveryMethod;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
  note?: string | null;
  // Always required — "payment_link" means nothing is collected now and a
  // Stripe Checkout link is generated separately instead.
  payment_method: OrderPaymentChoice;
  amount_paid?: number; // dollars — omit/0 leaves the invoice fully outstanding
}

export const createManualOrder = async (payload: CreateManualOrderPayload) => {
  const { data } = await apiClient.post<BeResponse<Order>>("/order/manual", payload);
  return data;
};

export const generatePaymentLink = async (orderId: string) => {
  const { data } = await apiClient.post<BeResponse<{ url: string }>>(`/order/${orderId}/payment-link`);
  return data;
};

export const addOrderNote = async (orderId: string, text: string) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/notes`, { text });
  return data;
};
