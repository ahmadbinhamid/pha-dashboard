import { ShoppingCart, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ActivityEvent } from "@/types/dashboard";

const TYPE_ICON: Record<ActivityEvent["type"], typeof ShoppingCart> = {
  order: ShoppingCart,
  stock: Boxes,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}, ${formatTime(iso)}`;
}

// Icon + title/description/tags block shared by the dashboard's compact
// Recent Activity feed and the full Activity Log page — only the timestamp
// format and the surrounding spacing/divider differ between the two.
export function ActivityEventRow({ event, showDate }: { event: ActivityEvent; showDate?: boolean }) {
  const Icon = TYPE_ICON[event.type];
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-2 text-fg/50">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-fg">{event.title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-fg/40">
            {showDate ? formatDateTime(event.timestamp) : formatTime(event.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-fg/55">{event.description}</p>
        {event.sku && <p className="mt-0.5 truncate text-xs text-fg/40">(SKU: {event.sku})</p>}
        {event.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {event.tags.map((tag) => (
              <Badge key={tag} variant="muted" className="px-1.5 py-0.5 text-[10px] capitalize">
                {tag.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
