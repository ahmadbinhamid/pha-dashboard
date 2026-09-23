import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { NativeSelect } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { DashboardStatTile } from "@/components/dashboard/DashboardStatTile";
import type { StatTileTone } from "@/components/dashboard/DashboardStatTile";
import { cn } from "@/utils/cn";
import { downloadPdf } from "@/utils/pdf";
import { formatCurrencyFromCents } from "@/utils/format";
import { CATEGORICAL_COLOR_VARS as CATEGORY_COLOR_VARS } from "@/config/categoricalColors";
import type { InventoryTurnoverResponse } from "@/types/reports";

type ViewMode = "rate" | "dsi" | "categories";

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: "rate", label: "Turnover Rate (x)" },
  { key: "dsi", label: "Days of Supply (DSI)" },
  { key: "categories", label: "Category Comparison" },
];

function formatDayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

// Days-of-inventory divides by COGS, so little/no recorded cost data (Product.cost_price is optional) sends it toward a meaningless thousands-of-days figure. Capping the display (not the underlying number, kept real for tooltip/PDF) keeps the KPI tiles readable.
const DSI_DISPLAY_CAP = 365;
function formatDsi(days: number) {
  if (!Number.isFinite(days) || days > DSI_DISPLAY_CAP) return `${DSI_DISPLAY_CAP}+ days`;
  return `${days.toFixed(1)} days`;
}

// A capped "365+ days" is the worst reading this card can produce, so it can't share the success tone with a fast-turning figure. Falls back to neutral, not danger, since it usually means missing cost_price data, not a real problem.
function dsiTone(days: number): StatTileTone {
  return Number.isFinite(days) && days <= DSI_DISPLAY_CAP ? "ok" : "neutral";
}

function TurnoverTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as InventoryTurnoverResponse["points"][number] & { label: string };
  return (
    <div className="min-w-[200px] space-y-1.5 rounded-md border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
      <div className="mb-1 border-b border-border pb-1.5 font-semibold text-fg">{point.label}</div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Turnover rate</span>
        <span className="font-medium tabular-nums text-fg">{point.turnoverRate.toFixed(2)}x</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Days of inventory</span>
        <span className="font-medium tabular-nums text-fg">{formatDsi(point.daysOfInventory)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Units dispatched</span>
        <span className="font-medium tabular-nums text-fg">{point.unitsMoved} units</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Cost of goods sold</span>
        <span className="font-medium tabular-nums text-fg">{formatCurrencyFromCents(point.cogsCents)}</span>
      </div>
    </div>
  );
}

export function InventoryTurnoverCard({
  turnover,
  loading,
  error,
}: {
  turnover?: InventoryTurnoverResponse;
  loading?: boolean;
  error?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("rate");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const categoryNames = useMemo(() => turnover?.categoryRanking.map((c) => c.name) ?? [], [turnover]);

  const data = useMemo(
    () => (turnover?.points ?? []).map((p) => ({ ...p, label: formatDayLabel(p.date) })),
    [turnover],
  );

  // categoryRates is a nested object the PDF table could only render as "[object Object]", so flattened here into one column per category. Days-of-inventory exports uncapped (only the tiles cap the display).
  const exportRows = useMemo(
    () =>
      (turnover?.points ?? []).map((point) => ({
        date: point.date,
        unitsMoved: point.unitsMoved,
        cogs: (point.cogsCents / 100).toFixed(2),
        turnoverRate: point.turnoverRate.toFixed(4),
        daysOfInventory: Number.isFinite(point.daysOfInventory) ? point.daysOfInventory.toFixed(1) : "",
        ...Object.fromEntries(
          categoryNames.map((name) => [`turnover_${name}`, (point.categoryRates[name] ?? 0).toFixed(4)]),
        ),
      })),
    [turnover, categoryNames],
  );

  if (error) {
    return (
      <Card className="space-y-5 p-5 shadow-card sm:p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
            <AlertTriangle className="h-8 w-8 text-fg/30" />
          </div>
          <div>
            <p className="font-medium text-fg">Turnover data couldn't be loaded</p>
            <p className="mt-1 text-sm text-fg/50">Try a different date range, or reload the page.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading || !turnover) {
    return (
      <Card className="space-y-5 p-5 shadow-card sm:p-6">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </Card>
    );
  }

  const { summary, categoryRanking } = turnover;

  return (
    <Card className="space-y-5 p-5 shadow-card transition-shadow duration-300 hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <RefreshCw className="h-4 w-4" />
            </span>
            <DashboardSectionLabel
              description="Cumulative turnover (Cost of Goods Sold ÷ current inventory value) and Days Sales of Inventory over the period."
            >
              {turnover.points.length}-Day Inventory Turnover &amp; Stock Velocity
            </DashboardSectionLabel>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex shrink-0 rounded-md border border-border bg-bg-2/40 p-0.5 text-xs">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  "rounded-sm px-2.5 py-1.5 font-semibold transition-colors",
                  viewMode === tab.key ? "bg-card text-fg shadow-sm" : "text-fg/50 hover:text-fg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {viewMode === "categories" && categoryNames.length > 0 && (
            <NativeSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-auto w-auto rounded-xl border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-fg shadow-none"
            >
              <option value="All">
                All {categoryNames.length} {categoryNames.length === 1 ? "category" : "categories"}
              </option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          )}

          <button
            type="button"
            onClick={() => downloadPdf("inventory_turnover", exportRows, { title: "Inventory Turnover" })}
            className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:bg-muted/70"
          >
            <Download className="h-3.5 w-3.5 text-fg/50" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardStatTile
          label="Avg Turnover"
          value={`${summary.avgTurnoverRate.toFixed(2)}x`}
          caption={`Across ${turnover.points.length} days`}
        />
        <DashboardStatTile
          label="Days to Sell (DSI)"
          value={formatDsi(summary.avgDaysOfInventory)}
          captionTone={dsiTone(summary.avgDaysOfInventory)}
          caption="Lower is faster-moving"
        />
        <DashboardStatTile
          label="Fastest Turning Category"
          value={summary.fastestCategory ? `${summary.fastestCategory.name} (${summary.fastestCategory.turnoverRate.toFixed(1)}x)` : "—"}
          captionTone={summary.fastestCategory ? dsiTone(summary.fastestCategory.daysOfInventory) : "neutral"}
          caption={summary.fastestCategory ? `${formatDsi(summary.fastestCategory.daysOfInventory)} turn` : "No sales yet"}
        />
        <DashboardStatTile label="Units Dispatched" value={summary.totalUnitsMoved} caption="Total for the period" />
      </div>

      <div className="h-72 w-full pt-2 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "rate" ? (
            <ComposedChart data={data} margin={{ top: 15, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="turnoverRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--color-border)" }} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} dy={6} />
              <YAxis yAxisId="rate" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} tickFormatter={(v: number) => `${v.toFixed(1)}x`} />
              <YAxis yAxisId="units" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-fg)", opacity: 0.4 }} />
              <Tooltip content={TurnoverTooltip} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
              <Bar yAxisId="units" dataKey="unitsMoved" name="Units Dispatched (Daily)" fill="var(--color-border)" radius={[4, 4, 0, 0]} barSize={12} />
              <Area
                yAxisId="rate"
                type="monotone"
                dataKey="turnoverRate"
                name="Cumulative Turnover Rate (x)"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#turnoverRateGradient)"
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          ) : viewMode === "dsi" ? (
            <AreaChart data={data} margin={{ top: 15, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="dsiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ok)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-ok)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--color-border)" }} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} dy={6} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} tickFormatter={(v: number) => `${v.toFixed(0)}d`} />
              <Tooltip content={TurnoverTooltip} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
              <Area
                type="monotone"
                dataKey="daysOfInventory"
                name="Days Sales of Inventory (DSI)"
                stroke="var(--color-ok)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#dsiGradient)"
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 15, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--color-border)" }} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} dy={6} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-fg)", opacity: 0.55 }} tickFormatter={(v: number) => `${v.toFixed(1)}x`} />
              <Tooltip content={TurnoverTooltip} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
              {categoryNames
                .filter((name) => categoryFilter === "All" || categoryFilter === name)
                .map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={`categoryRates.${name}`}
                    name={name}
                    stroke={CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {categoryRanking.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3 text-xs sm:grid-cols-5">
          {categoryRanking.slice(0, 5).map((cat, i) => (
            <div key={cat.name} className="flex min-w-0 items-center justify-between rounded-xl border border-border bg-muted/40 p-2.5">
              <div className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-fg">{cat.name}</span>
                <span className="truncate text-[10px] text-fg/45">{formatDsi(cat.daysOfInventory)} turn</span>
              </div>
              <span
                className="rounded px-1.5 py-0.5 text-xs font-bold"
                style={{
                  color: CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length],
                  backgroundColor: `color-mix(in srgb, ${CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length]} 12%, transparent)`,
                }}
              >
                {cat.turnoverRate.toFixed(1)}x
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
