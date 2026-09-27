import { Badge } from "@/components/ui/Badge";
import type { OrderPaymentStatus } from "@/types/orders";

// Read-only: payment status is always derived server-side (order.service.js#derivePaymentStatus, refund.service.js#recomputeLedger), never set by hand; kept separate from OrderStatusBadge (order lifecycle).
const PAYMENT_STATUS_VARIANT: Record<OrderPaymentStatus, "ok" | "warn" | "danger" | "muted" | "default"> = {
  pending_payment: "muted",
  partially_paid: "warn",
  paid: "ok",
  partially_refunded: "warn",
  refunded: "danger",
};

const PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  pending_payment: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  partially_refunded: "Partially Refunded",
  refunded: "Refunded",
};

export function OrderPaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  return <Badge variant={PAYMENT_STATUS_VARIANT[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}
