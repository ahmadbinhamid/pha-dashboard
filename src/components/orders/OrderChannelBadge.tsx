import { Badge } from "@/components/ui/Badge";
import type { OrderChannel } from "@/types/orders";

const LABEL: Record<OrderChannel, string> = {
  storefront: "Storefront",
  ebay: "eBay",
};

export function OrderChannelBadge({ channel }: { channel: OrderChannel }) {
  return <Badge variant="outline">{LABEL[channel]}</Badge>;
}
