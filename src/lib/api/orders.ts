import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Order, OrderAddress, OrderDeliveryMethod, OrderDetail } from "@/types/orders";
import type { OrderPaymentChoice, PaymentMethod } from "@/types/payment";

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

export interface RecordOrderPaymentPayload {
  payment_method: PaymentMethod;
  amount: number; // dollars
}

// Follow-up cash/online-transfer payment against an order's outstanding
// balance — e.g. settling the rest of a manual sale's deposit later.
export const recordOrderPayment = async (orderId: string, payload: RecordOrderPaymentPayload) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/payments`, payload);
  return data;
};

export const addOrderNote = async (orderId: string, text: string) => {
  const { data } = await apiClient.post<BeResponse<Order>>(`/order/${orderId}/notes`, { text });
  return data;
};

export interface UpdateOrderCustomerDetailsPayload {
  customer?: { name?: string; email?: string | null; phone?: string | null };
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress | null;
}

// Corrects the order's own customer/address snapshot — never the linked
// Customer record (see order.service.js#updateOrderCustomerDetails).
export const updateOrderCustomerDetails = async (orderId: string, payload: UpdateOrderCustomerDetailsPayload) => {
  const { data } = await apiClient.put<BeResponse<Order>>(`/order/${orderId}/customer-details`, payload);
  return data;
};
