import { Badge } from "@/components/ui/Badge";
import { ORDER_CHANNEL_LABEL, ORDER_CHANNEL_STYLE } from "@/config/orderChannels";
import { cn } from "@/utils/cn";
import type { OrderChannel } from "@/types/orders";

// cn lets the channel colour override the outline variant's text and ring.
export function OrderChannelBadge({ channel, className }: { channel: OrderChannel; className?: string }) {
  return (
    <Badge variant="outline" className={cn(ORDER_CHANNEL_STYLE[channel].badge, className)}>
      {ORDER_CHANNEL_LABEL[channel]}
    </Badge>
  );
}
