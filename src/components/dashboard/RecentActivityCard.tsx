import { useNavigate } from "react-router-dom";
import { ShoppingCart, Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import type { ActivityEvent } from "@/types/dashboard";

const TYPE_ICON: Record<ActivityEvent["type"], typeof ShoppingCart> = {
  order: ShoppingCart,
  stock: Boxes,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function RecentActivityCard({ events, loading }: { events: ActivityEvent[]; loading?: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <DashboardSectionLabel>Recent Activity</DashboardSectionLabel>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg/35">Live Feed</span>
      </div>

      <CardContent className="flex-1 space-y-1 px-0 pt-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-bg-2" />)
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-sm text-fg/45">No recent activity</div>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {events.map((event) => {
              const Icon = TYPE_ICON[event.type];
              return (
                <div key={event.id} className="flex gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-2 text-fg/50">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">{event.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-fg/40">{formatTime(event.timestamp)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg/55">{event.description}</p>
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
            })}
          </div>
        )}
      </CardContent>

      <button
        type="button"
        onClick={() => navigate("/orders")}
        className="mt-3 text-center text-xs font-medium text-accent transition hover:underline"
      >
        View Full Activity Log
      </button>
    </Card>
  );
}
