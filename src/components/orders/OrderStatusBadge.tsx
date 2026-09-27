import { Badge } from "@/components/ui/Badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/config/orderStatus";
import type { OrderFulfillmentStatus } from "@/types/orders";

export function OrderStatusBadge({ status }: { status: OrderFulfillmentStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
