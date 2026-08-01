import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Order } from "@/types/orders";

// Guest/unauthenticated endpoints backing the shared payment-link page
// (/pay/:orderId) — tenant is resolved server-side from the order itself
// (see server/src/middlewares/tenant.js), no login and no X-Tenant-Slug
// header involved. Security comes entirely from the guest `token`, which
// must be sent alongside the order id on every call.

export const getGuestOrder = async (orderId: string, token: string) => {
  const { data } = await apiClient.get<BeResponse<Order>>(`/order/${orderId}`, {
    params: { token },
  });
  return data;
};

export const createGuestPaymentIntent = async (orderId: string, token: string) => {
  const { data } = await apiClient.post<
    BeResponse<{ payment_id: string; client_secret: string; stripe_account_id: string }>
  >("/payment/create-intent", { order_id: orderId, token });
  return data;
};
