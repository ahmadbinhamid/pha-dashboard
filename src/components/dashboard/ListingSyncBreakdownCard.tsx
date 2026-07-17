import { Card, CardContent } from "@/components/ui/Card";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";
import type { SyncStatusBreakdownItem } from "@/types/dashboard";

const DOT_CLASS: Record<string, string> = {
  ok: "bg-[hsl(var(--ok))]",
  warn: "bg-[hsl(var(--warn))]",
  danger: "bg-[hsl(var(--danger))]",
  muted: "bg-fg/35",
  default: "bg-fg/35",
  outline: "bg-fg/35",
};

export function ListingSyncBreakdownCard({
  items,
  loading,
}: {
  items: SyncStatusBreakdownItem[];
  loading?: boolean;
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4">
        <DashboardSectionLabel>Listing Sync Status</DashboardSectionLabel>

        {loading ? (
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-xs bg-bg-2" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-fg/45">
            No listings yet
          </div>
        ) : (
          <div className="flex-1 space-y-3">
            {items.map((item) => {
              const cfg = LISTING_SYNC_STATUS_CONFIG[item.status];
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-fg/70">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[cfg.variant]}`} />
                      {cfg.label}
                    </span>
                    <span className="tabular-nums text-fg/55">
                      {item.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
                    <div
                      className={`h-full rounded-full ${DOT_CLASS[cfg.variant]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
