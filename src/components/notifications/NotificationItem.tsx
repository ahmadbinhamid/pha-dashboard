import { Badge } from "@/components/ui/Badge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { ORDER_CHANNEL_STYLE } from "@/config/orderChannels";
import { formatCurrencyFromCents } from "@/utils/format";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { cn } from "@/utils/cn";
import type { AppNotification } from "@/types/notification";

interface NotificationItemProps {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
}

// The left accent carries the channel colour (or red when overdue) at a glance.
export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const { type, title, message, data, read_at } = notification;
  const isOverdue = type === "order.overdue";
  const accent = isOverdue ? "border-l-danger" : (ORDER_CHANNEL_STYLE[data.channel]?.accent ?? "border-l-border");

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "flex w-full gap-3 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-bg-2",
        "focus-visible:bg-bg-2 focus-visible:outline-none",
        accent,
        !read_at && "bg-accent/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", read_at ? "font-medium text-fg/80" : "font-semibold text-fg")}>
            {title}
          </span>
          <span className="shrink-0 text-2xs text-fg/40">{formatRelativeTime(notification.created_at)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-fg/60">{message}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          {isOverdue ? (
            <Badge variant="danger" className="px-2 py-0.5 text-2xs">
              Overdue
            </Badge>
          ) : (
            data.channel && <OrderChannelBadge channel={data.channel} className="px-2 py-0.5 text-2xs" />
          )}
          <span className="text-xs font-medium tabular-nums text-fg/70">{formatCurrencyFromCents(data.total)}</span>
        </div>
      </div>
      {!read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </button>
  );
}
