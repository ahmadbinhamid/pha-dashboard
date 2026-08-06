import { Badge } from "@/components/ui/Badge";
import type { OrderFulfillmentStatus } from "@/types/orders";

// Exported so OrderStatusSelect (the editable dropdown version of this same
// badge) can render the identical color/label for whichever status is
// currently selected, instead of drifting out of sync with its own copy.
export const ORDER_STATUS_VARIANT: Record<OrderFulfillmentStatus, "ok" | "warn" | "danger" | "muted" | "default"> = {
  pending: "warn",
  processing: "default",
  on_hold: "warn",
  completed: "ok",
  cancelled: "danger",
};

export const ORDER_STATUS_LABEL: Record<OrderFulfillmentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderFulfillmentStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
