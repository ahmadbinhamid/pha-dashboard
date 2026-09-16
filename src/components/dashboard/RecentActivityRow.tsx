import { eventVisual, formatTime } from "@/components/activity/ActivityEventRow";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { Badge } from "@/components/ui/Badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { cn } from "@/utils/cn";
import type { ActivityEvent } from "@/types/dashboard";
import type { OrderChannel } from "@/types/orders";

// A compact variant of ActivityEventRow for the dashboard's Recent Activity
// card specifically (the full multi-line detail view — every adjustment
// tag, not just channel/SKU — stays on the Activity Log page
// ActivityEventRow was built for). Channel/SKU get their own row below the
// description rather than sharing its line — squeezing a pill onto the same
// line as the description left barely any room for it, so it was
// truncating mid-word ("...Manual sal...") on nearly every row.
export function RecentActivityRow({ event }: { event: ActivityEvent }) {
  const { icon: Icon, style } = eventVisual(event);
  // Order events tag their channel as tags[0] (see mapOrderEvent in
  // dashboard.service.js) — safe to read directly since that's only ever a
  // real OrderChannel value for an "order" event.
  const channel = event.type === "order" ? (event.tags[0] as OrderChannel) : null;

  return (
    <div className="flex gap-3">
      <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style)}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 truncate text-sm font-semibold text-fg">{event.title}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{event.title}</TooltipContent>
          </Tooltip>
          <span className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium tabular-nums text-fg/50">
            {formatTime(event.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-fg/55">{event.description}</p>
        {(channel || event.sku) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {channel && <OrderChannelBadge channel={channel} />}
            {event.sku && (
              <Badge variant="muted" className="font-mono">
                {event.sku}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
