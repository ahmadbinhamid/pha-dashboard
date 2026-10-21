import type { OrderDeliveryMethod } from "@/types/orders";

export const DELIVERY_METHODS: OrderDeliveryMethod[] = ["delivery", "local_delivery", "pickup"];

export const DELIVERY_METHOD_LABEL: Record<OrderDeliveryMethod, string> = {
  delivery: "Delivery",
  local_delivery: "Local delivery",
  pickup: "Pickup",
};

// Only carrier delivery is charged freight, matching createManualOrder.
export const CHARGES_SHIPPING: Record<OrderDeliveryMethod, boolean> = {
  delivery: true,
  local_delivery: false,
  pickup: false,
};

// Pickup is the only method with no address to deliver to.
export const NEEDS_ADDRESS: Record<OrderDeliveryMethod, boolean> = {
  delivery: true,
  local_delivery: true,
  pickup: false,
};
