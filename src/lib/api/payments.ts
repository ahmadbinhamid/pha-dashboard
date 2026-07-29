import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { Payment, PaymentDetail } from "@/types/payment";

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

// refundPayment/refundPaymentManual removed (refund-redesign-spec.md §9) —
// see src/lib/api/refunds.ts#createRefund (POST /order/:orderId/refunds).
