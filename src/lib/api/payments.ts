import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Payment, PaymentDetail, Refund, RefundReason } from "@/types/payment";

export interface PaymentListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export const getPayments = async (params: PaymentListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<Payment>>>("/payment", { params });
  return data;
};

export const getPayment = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<PaymentDetail>>(`/payment/${id}`);
  return data;
};

export interface RefundPaymentPayload {
  amount: number; // cents
  reason: RefundReason;
  restock?: boolean;
}

export const refundPayment = async (id: string, payload: RefundPaymentPayload) => {
  const { data } = await apiClient.post<BeResponse<Refund>>(`/payment/${id}/refund`, payload);
  return data;
};
