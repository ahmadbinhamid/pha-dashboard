import { Badge } from "@/components/ui/Badge";
import { isOrderOverdue } from "@/lib/orders/overdue";
import type { Order } from "@/types/orders";

interface OrderOverdueBadgeProps {
  order: Pick<Order, "due_date" | "payment_status" | "fulfillment_status">;
}

// Renders nothing unless the account invoice is past due and still owing.
export function OrderOverdueBadge({ order }: OrderOverdueBadgeProps) {
  if (!isOrderOverdue(order)) return null;
  return <Badge variant="danger">Overdue</Badge>;
}
