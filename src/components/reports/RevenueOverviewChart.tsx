import { useMemo, useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderVolumePoint } from "@/types/dashboard";

// Separate scales, no y-axis: only shape is meaningful; tooltip shows values

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

// Past this many points, per-point dots become a rope, so they drop out
const MAX_POINTS_WITH_DOTS = 31;

// Share of plot height each series' max fills; line rides tops of the bars
const PEAK_BAR_HEIGHT = 0.55;
const PEAK_LINE_HEIGHT = 0.95;

/** Long ranges open already rolled up; the dropdown can still override. */
function defaultGranularity(pointCount: number): Granularity {
  if (pointCount > 180) return "monthly";
  if (pointCount > 45) return "weekly";
  return "daily";
}

const AXIS_TICK = { fontSize: 10, opacity: 0.55 };

type Bucket = {
  key: string;
  /** Short form for the x-axis. */
  label: string;
  /** Days covered, for the tooltip: a rolled-up bucket may be partial. */
  rangeLabel: string;
  revenueCents: number;
  orders: number;
};

/** Monday-start ISO week key so a week never straddles two buckets. */
function weekStart(date: Date) {
  const d = new Date(date);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - weekday);
  return d;
}

const DAY_MONTH = { day: "numeric", month: "short" } as const;

function asDate(isoDay: string) {
  return new Date(`${isoDay}T00:00:00`);
}

/** Re-anchor UTC date to local midnight so toLocaleDateString won't shift */
function localMidnight(utcDay: Date) {
  return new Date(utcDay.getUTCFullYear(), utcDay.getUTCMonth(), utcDay.getUTCDate());
}

function bucketPoints(points: OrderVolumePoint[], granularity: Granularity): Bucket[] {
  if (granularity === "daily") {
    return points.map((p) => ({
      key: p.date,
      label: asDate(p.date).toLocaleDateString("en-AU", DAY_MONTH),
      rangeLabel: asDate(p.date).toLocaleDateString("en-AU", { ...DAY_MONTH, weekday: "short", year: "numeric" }),
      revenueCents: p.revenueCents,
      orders: p.orders,
    }));
  }

  // Accumulate first: a bucket's range is unknown until its last day
  const spans = new Map<string, { start: Date; firstDay: string; lastDay: string; revenueCents: number; orders: number }>();

  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const start = granularity === "weekly" ? weekStart(date) : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const key = start.toISOString().slice(0, 10);

    const existing = spans.get(key);
    if (existing) {
      existing.revenueCents += point.revenueCents;
      existing.orders += point.orders;
      // Compared, not assigned, so out-of-order days don't break the span
      if (point.date < existing.firstDay) existing.firstDay = point.date;
      if (point.date > existing.lastDay) existing.lastDay = point.date;
      continue;
    }

    spans.set(key, {
      start,
      firstDay: point.date,
      lastDay: point.date,
      revenueCents: point.revenueCents,
      orders: point.orders,
    });
  }

  return Array.from(spans.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, span]) => ({
      key,
      label:
        granularity === "weekly"
          ? localMidnight(span.start).toLocaleDateString("en-AU", DAY_MONTH)
          : localMidnight(span.start).toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
      rangeLabel:
        span.firstDay === span.lastDay
          ? asDate(span.firstDay).toLocaleDateString("en-AU", { ...DAY_MONTH, year: "numeric" })
          : `${asDate(span.firstDay).toLocaleDateString("en-AU", DAY_MONTH)} – ${asDate(span.lastDay).toLocaleDateString("en-AU", { ...DAY_MONTH, year: "numeric" })}`,
      revenueCents: span.revenueCents,
      orders: span.orders,
    }));
}

/** Per-series domain from zero: max/PEAK puts the tallest at PEAK height. */
function seriesDomains(data: Bucket[]): { revenue: [number, number]; orders: [number, number] } {
  const maxRevenue = Math.max(0, ...data.map((d) => d.revenueCents));
  const maxOrders = Math.max(0, ...data.map((d) => d.orders));

  // All-zero range would give a zero-height/inverted domain (blank plot)
  return {
    revenue: [0, maxRevenue > 0 ? maxRevenue / PEAK_BAR_HEIGHT : 1],
    orders: [0, maxOrders > 0 ? maxOrders / PEAK_LINE_HEIGHT : 1],
  };
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as Bucket;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
      <div className="mb-1.5 border-b border-border pb-1.5 font-semibold text-fg">{point.rangeLabel}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-fg/60">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Revenue
        </span>
        <span className="font-medium tabular-nums text-fg">{formatCurrencyFromCents(point.revenueCents)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-fg/60">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-cat-1)" }} />
          Orders
        </span>
        <span className="font-medium tabular-nums text-fg">{point.orders}</span>
      </div>
    </div>
  );
}

export function RevenueOverviewChart({
  points,
  loading,
  animate = true,
}: {
  points: OrderVolumePoint[];
  loading?: boolean;
  /** Grow-in animation uses rAF, which headless screenshots can't advance. */
  animate?: boolean;
}) {
  // null = follow the range; a dropdown choice survives date range changes
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const granularity = chosen ?? defaultGranularity(points.length);
  const data = useMemo(() => bucketPoints(points, granularity), [points, granularity]);
  const domains = useMemo(() => seriesDomains(data), [data]);
  const showDots = data.length <= MAX_POINTS_WITH_DOTS;
  // Days with nothing sold would draw a flat line reading as steady trade
  const isEmpty = data.every((d) => d.revenueCents === 0 && d.orders === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Legend: two series in one plot, so identity can't rest on position. */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="text-fg/60">Revenue (AUD)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-cat-1)" }} />
            <span className="text-fg/60">Orders</span>
          </span>
        </div>

        <SingleSelect
          size="sm"
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={(v) => setChosen(v as Granularity)}
          className="h-8 min-w-28"
        />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : isEmpty ? (
        <div className="flex h-64 items-center justify-center text-sm text-fg/45">No orders in this range yet</div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ ...AXIS_TICK, fill: "var(--color-fg)" }}
                // Under ~8 buckets label all; past that the gap rule avoids collisions
                interval={data.length <= 8 ? 0 : "preserveStartEnd"}
                minTickGap={24}
              />
              {/* Axes hidden: they only carry the banded domains. */}
              <YAxis yAxisId="revenue" hide domain={domains.revenue} />
              <YAxis yAxisId="orders" hide domain={domains.orders} />
              <Tooltip content={ChartTooltip} cursor={{ fill: "var(--color-border)", opacity: 0.25 }} />
              <Bar
                yAxisId="revenue"
                dataKey="revenueCents"
                fill="var(--color-accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive={animate}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="var(--color-cat-1)"
                strokeWidth={2.5}
                dot={showDots ? { r: 4.5, fill: "var(--color-cat-1)", strokeWidth: 2, stroke: "var(--color-card)" } : false}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--color-card)" }}
                isAnimationActive={animate}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
