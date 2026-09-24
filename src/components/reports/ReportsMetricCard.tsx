import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";

// Categorical --cat-* tones: these KPIs are identities, not status signals.
export type ReportsMetricColorVar =
  | "var(--color-accent)"
  | "var(--color-cat-1)"
  | "var(--color-cat-3)"
  | "var(--color-cat-4)"
  | "var(--color-cat-6)";

export function ReportsMetricCard({
  label,
  value,
  changePct,
  changeLabel = "vs prior period",
  icon,
  colorVar,
  sparkline,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  changePct: number | null;
  changeLabel?: string;
  icon: React.ReactNode;
  colorVar: ReportsMetricColorVar;
  /** Real per-day series for the same range (e.g. dailyRevenueCents) — not... */
  sparkline: number[];
  loading?: boolean;
}) {
  const isUp = changePct !== null && changePct >= 0;
  const sparklineData = sparkline.map((v) => ({ v }));

  return (
    <Card className="group relative flex min-w-0 flex-col gap-3 overflow-hidden p-4 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 group-hover:bg-[var(--tone)] group-hover:text-white"
            style={
              {
                "--tone": colorVar,
                color: colorVar,
                backgroundColor: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
              } as React.CSSProperties
            }
          >
            {icon}
          </span>
          <span className="text-xs font-medium text-fg/55">{label}</span>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div>
          <div className="text-xl font-bold tracking-tight text-fg tabular-nums">{value}</div>
          {changePct !== null ? (
            <div className={cn("mt-1 flex items-center gap-1 text-2xs font-semibold", isUp ? "text-ok" : "text-danger")}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>
                {isUp ? "+" : ""}
                {changePct.toFixed(1)}% {changeLabel}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-2xs font-medium text-fg/40">No prior period yet</div>
          )}
        </div>
      )}

      <div className="-mb-1 h-8 w-full">
        {loading || sparklineData.length < 2 ? null : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line type="monotone" dataKey="v" stroke={colorVar} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
