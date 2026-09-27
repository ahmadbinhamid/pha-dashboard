import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Order } from "@/types/orders";

// Guest/unauthenticated endpoints for the shared payment-link page (/pay/:orderId) — tenant resolves server-side from the order (middlewares/tenant.js). Security comes entirely from the guest `token` sent with every call.

export const getGuestOrder = async (orderId: string, token: string) => {
  const { data } = await apiClient.get<BeResponse<Order>>(`/order/${orderId}`, {
    params: { token },
  });
  return data;
};

export const createGuestPaymentIntent = async (orderId: string, token: string) => {
  const { data } = await apiClient.post<
    BeResponse<{ payment_id: string; client_secret: string; stripe_publishable_key: string }>
  >("/payment/create-intent", { order_id: orderId, token });
  return data;
};
