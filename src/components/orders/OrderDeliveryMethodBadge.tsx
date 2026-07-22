import { Badge } from "@/components/ui/Badge";
import type { OrderDeliveryMethod } from "@/types/orders";

const LABEL: Record<OrderDeliveryMethod, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
};

export function OrderDeliveryMethodBadge({ method }: { method: OrderDeliveryMethod }) {
  return <Badge variant="outline">{LABEL[method]}</Badge>;
}
