import { Badge } from "@/components/ui/Badge";
import { DELIVERY_METHOD_LABEL } from "@/config/deliveryMethods";
import type { OrderDeliveryMethod } from "@/types/orders";

export function OrderDeliveryMethodBadge({ method }: { method: OrderDeliveryMethod }) {
  return <Badge variant="outline">{DELIVERY_METHOD_LABEL[method]}</Badge>;
}
