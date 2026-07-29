import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Refund, RefundableSummary, CreateRefundPayload } from "@/types/refund";

// refund-redesign-spec.md §2 — order-scoped, not payment-scoped. Mounted
// under /order (this app's existing convention, not the spec's literal
// /orders — see server/src/routes/order.routes.js).

export const getRefundable = async (orderId: string) => {
  const { data } = await apiClient.get<BeResponse<RefundableSummary>>(`/order/${orderId}/refundable`);
  return data;
};

export const listRefunds = async (orderId: string) => {
  const { data } = await apiClient.get<BeResponse<Refund[]>>(`/order/${orderId}/refunds`);
  return data;
};

// The client computes no money — it posts the intent (scope, lines +
// quantities + restock flags, or a bare amount) and renders whatever the
// server's response returns.
export const createRefund = async (orderId: string, payload: CreateRefundPayload) => {
  const { data } = await apiClient.post<BeResponse<Refund>>(`/order/${orderId}/refunds`, payload);
  return data;
};

export const voidRefund = async (refundId: string, reason: string) => {
  const { data } = await apiClient.post<BeResponse<Refund>>(`/refund/${refundId}/void`, { reason });
  return data;
};

export const retryRestock = async (refundId: string) => {
  const { data } = await apiClient.post<BeResponse<Refund>>(`/refund/${refundId}/retry-restock`);
  return data;
};
