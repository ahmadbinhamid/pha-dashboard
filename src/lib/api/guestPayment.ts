import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { GuestOrder } from "@/types/orders";

// Unauthenticated /pay/:orderId calls; the guest token is the only credential.

export const getGuestOrder = async (orderId: string, token: string) => {
  const { data } = await apiClient.get<BeResponse<GuestOrder>>(`/order/${orderId}`, {
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
