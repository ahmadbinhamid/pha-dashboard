import type { OrderFulfillmentStatus } from "@/types/orders";

type BadgeVariant = "ok" | "warn" | "danger" | "muted" | "default";

// Lifecycle order, as offered in the status picker and the list filter.
export const ORDER_STATUSES: OrderFulfillmentStatus[] = ["pending", "processing", "on_hold", "completed", "cancelled"];

export const ORDER_STATUS_LABEL: Record<OrderFulfillmentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_VARIANT: Record<OrderFulfillmentStatus, BadgeVariant> = {
  pending: "warn",
  processing: "default",
  on_hold: "warn",
  completed: "ok",
  cancelled: "danger",
};
