import { useMemo, useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderVolumePoint } from "@/types/dashboard";

// Revenue (bars) and orders (line) in one plot. Two separate scales (dollars vs counts), so the gap between line and bar is not a quantity — only their shape (both measured from the same zero, scaled to their own peak) is meaningful.
// Neither y-axis is drawn, so the hover tooltip is the only place the numbers exist. Don't add gridlines/a shared axis — they'd invite reading the vertical gap as a difference. If reopened, two stacked plots (small multiples) is the honest form.

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

// Beyond this many points, a marker per point becomes a rope, so dots drop out and the hover marker does the work.
const MAX_POINTS_WITH_DOTS = 31;

// How much plot height each series' max fills. Both measured from the same floor, so the line rides the tops of the bars rather than floating separately; a no-orders day pulls it to baseline with its missing bar.
// The 55%/95% headroom keeps the line clear of the bars proportionally, not absolutely — it only dips into a bar on a day carried by one unusually large order, a real fact left visible rather than designed away.
const PEAK_BAR_HEIGHT = 0.55;
const PEAK_LINE_HEIGHT = 0.95;

/** Which granularity a range opens on — a long range (90 daily bars in ~500px) starts already rolled up; the dropdown can still override it. */
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
  /** The days this bucket covers, for the tooltip — a rolled-up bucket is often partial (e.g. a 6-day final week), and the axis label alone doesn't say which days. */
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

/** Bucket boundaries are computed in UTC, but toLocaleDateString formats in local time (west of UTC, 1 Sept 00:00Z becomes 31 Aug) — re-anchor to local midnight on the same calendar day first. */
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

  // Accumulate first, label after: a bucket's covered range isn't known until its last day is seen.
  const spans = new Map<string, { start: Date; firstDay: string; lastDay: string; revenueCents: number; orders: number }>();

  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const start = granularity === "weekly" ? weekStart(date) : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const key = start.toISOString().slice(0, 10);

    const existing = spans.get(key);
    if (existing) {
      existing.revenueCents += point.revenueCents;
      existing.orders += point.orders;
      // Compared, not assigned: the endpoint returns days in order today, but a bucket's span shouldn't silently break if that changes.
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

/** Domains that let each series use its own full range from a shared zero: max/PEAK puts the tallest value at PEAK of plot height, everything else scales below it. */
function seriesDomains(data: Bucket[]): { revenue: [number, number]; orders: [number, number] } {
  const maxRevenue = Math.max(0, ...data.map((d) => d.revenueCents));
  const maxOrders = Math.max(0, ...data.map((d) => d.orders));

  // An all-zero (or fully refunded) range would otherwise give a zero-height/inverted domain, rendering as a blank plot.
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
  /** Recharts' grow-in animation runs on requestAnimationFrame, which headless screenshots can't advance (lands on an empty frame zero) — off only for that. */
  animate?: boolean;
}) {
  // null = "follow the range"; once the dropdown is touched, that choice wins so changing the date range doesn't silently undo it.
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const granularity = chosen ?? defaultGranularity(points.length);
  const data = useMemo(() => bucketPoints(points, granularity), [points, granularity]);
  const domains = useMemo(() => seriesDomains(data), [data]);
  const showDots = data.length <= MAX_POINTS_WITH_DOTS;
  // Also true of a range with days but nothing sold — plotting that draws a flat line reading as steady trade, not no trade. Same copy as this page's other empty states.
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

        <FilterSelect
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
                // Under ~8 buckets every one is labelled outright, since a 7-slot band at this card's width would otherwise drop every second label; past 8, the gap rule takes over since forced labels would collide.
                interval={data.length <= 8 ? 0 : "preserveStartEnd"}
                minTickGap={24}
              />
              {/* Both axes hidden — they exist only to carry the banded domains. Values come from the tooltip. */}
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
