import { useNavigate } from "react-router-dom";
import { AlertTriangle, Box, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { cn } from "@/utils/cn";
import { formatCompactNumber } from "@/utils/format";
import type { DashboardStats } from "@/types/dashboard";

const TONE_STYLES = {
  accent: { box: "bg-accent/5 border-accent/20", icon: "text-accent" },
  // Non-status figure: turnover has no healthy threshold, so no status tone.
  neutral: { box: "bg-muted/40 border-border", icon: "text-fg/45" },
  warn: { box: "bg-warn/5 border-warn/20", icon: "text-warn" },
  danger: { box: "bg-danger/5 border-danger/20", icon: "text-danger" },
  ok: { box: "bg-ok/5 border-ok/20", icon: "text-ok" },
} as const;

function InsightBox({
  tone,
  icon,
  label,
  value,
  caption,
}: {
  tone: keyof typeof TONE_STYLES;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  caption?: string;
}) {
  const styles = TONE_STYLES[tone];
  return (
    // min-w-0: grid items default to min-width:auto, which blocks truncate.
    <div className={cn("min-w-0 space-y-1 rounded-xl border p-2.5", styles.box)}>
      <div className={cn("flex items-start gap-1.5", styles.icon)}>
        <span className="mt-0.5 shrink-0">{icon}</span>
        {/* Label wraps to 2 lines; truncating left it unreadable here. */}
        <span className="text-3xs font-semibold uppercase leading-tight">{label}</span>
      </div>
      <p className="truncate text-compact font-bold text-fg tabular-nums">{value}</p>
      {/* Wraps: truncating at ~70px cut mid-word, which reads as broken. */}
      {caption ? <p className={cn("text-3xs font-semibold leading-tight", styles.icon)}>{caption}</p> : null}
    </div>
  );
}

export function InventoryInsightsCard({
  stats,
  turnoverRate,
  loading,
}: {
  stats?: DashboardStats;
  turnoverRate?: number;
  loading?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
      <DashboardSectionLabel>Inventory Insights</DashboardSectionLabel>

      <CardContent className="flex-1 px-0 pt-4">
        {loading || !stats ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <InsightBox
              tone="accent"
              icon={<Box className="h-3.5 w-3.5" />}
              // Short labels: full names spilled onto a 3rd line at ~125px width.
              label="Inventory Value"
              // Compact notation (A$414K): the full amount won't fit untruncated.
              value={`A$${formatCompactNumber(stats.totalInventoryValue)}`}
              caption={
                stats.inventoryValueChangePct !== null
                  ? `${stats.inventoryValueChangePct >= 0 ? "↗" : "↘"} ${Math.abs(stats.inventoryValueChangePct).toFixed(1)}% ·\u00a07d`
                  : undefined
              }
            />
            <InsightBox
              tone="warn"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Low Stock"
              value={stats.lowStockCount}
            />
            <InsightBox
              tone="danger"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Out of Stock"
              value={stats.outOfStockCount}
            />
            <InsightBox
              tone="neutral"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Stock Turnover"
              value={turnoverRate !== undefined ? `${turnoverRate.toFixed(1)}x` : "—"}
            />
          </div>
        )}
      </CardContent>

      <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/inventory")}>
        View Inventory Report
      </Button>
    </Card>
  );
}
