import { Card, CardContent } from "@/components/ui/Card";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { formatCurrencyFromCents } from "@/utils/format";
import type { RevenueTrendPoint } from "@/types/dashboard";

const CHART_HEIGHT = 140;

export function RevenueTrendCard({
  points,
  loading,
}: {
  points: RevenueTrendPoint[];
  loading?: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => p.totalCents));
  const total = points.reduce((sum, p) => sum + p.totalCents, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between">
          <DashboardSectionLabel>Revenue Trend</DashboardSectionLabel>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums text-fg">
              {formatCurrencyFromCents(total)}
            </div>
            <div className="text-[11px] text-fg/45">last {points.length} days</div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-end gap-1.5" style={{ height: CHART_HEIGHT }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-t-xs bg-bg-2"
                style={{ height: `${20 + (i % 5) * 15}%` }}
              />
            ))}
          </div>
        ) : points.every((p) => p.totalCents === 0) ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-sm text-fg/45"
            style={{ height: CHART_HEIGHT }}
          >
            No revenue in this period
          </div>
        ) : (
          <div className="flex gap-1.5" style={{ height: CHART_HEIGHT }}>
            {points.map((p) => {
              const heightPct = Math.max(3, Math.round((p.totalCents / max) * 100));
              return (
                <div
                  key={p.date}
                  className="group relative flex h-full flex-1 items-end"
                  title={`${p.date}: ${formatCurrencyFromCents(p.totalCents)}`}
                >
                  <div
                    className="w-full rounded-t-xs bg-accent/70 transition-colors group-hover:bg-accent"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
