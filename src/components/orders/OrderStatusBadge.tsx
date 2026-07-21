import { Badge } from "@/components/ui/Badge";
import type { OrderStatus } from "@/types/orders";

const VARIANT: Record<OrderStatus, "ok" | "warn" | "danger" | "muted" | "default"> = {
  pending_payment: "warn",
  paid: "ok",
  fulfilled: "default",
  cancelled: "muted",
  refunded: "danger",
  partially_refunded: "warn",
};

const LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
