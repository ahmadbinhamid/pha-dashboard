import { Badge } from "@/components/ui/Badge";
import type { OrderStatus } from "@/types/orders";

// Exported so OrderStatusSelect (the editable dropdown version of this same
// badge) can render the identical color/label for whichever status is
// currently selected, instead of drifting out of sync with its own copy.
export const ORDER_STATUS_VARIANT: Record<OrderStatus, "ok" | "warn" | "danger" | "muted" | "default"> = {
  pending_payment: "warn",
  partially_paid: "warn",
  paid: "ok",
  fulfilled: "default",
  cancelled: "muted",
  refunded: "danger",
  partially_refunded: "warn",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  partially_paid: "Partially Paid",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
