import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { BarChart2, DollarSign, Download, Lightbulb, Package, RefreshCw, ShoppingCart, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { ReportsMetricCard } from "@/components/reports/ReportsMetricCard";
import { InventoryTurnoverCard } from "@/components/reports/InventoryTurnoverCard";
import { RevenueByChannelCard } from "@/components/reports/RevenueByChannelCard";
import { TopCategoriesCard } from "@/components/reports/TopCategoriesCard";
import { SalesPerformanceTable } from "@/components/reports/SalesPerformanceTable";
import { InventoryInsightsCard } from "@/components/reports/InventoryInsightsCard";
import { ReportsExportPanel } from "@/components/reports/ReportsExportPanel";
import { getDashboardStats, getOrderVolume } from "@/lib/api/dashboard";
import {
  getInventoryTurnover,
  getReportsSummary,
  getRevenueByChannel,
  getSalesPerformance,
  getTopCategories,
} from "@/lib/api/reports";
import { downloadCsv } from "@/utils/csv";
import { formatCurrencyFromCents } from "@/utils/format";
import { formatDateRangeLabel, getPresetRange } from "@/utils/dateRange";
import type { DateRangeValue } from "@/utils/dateRange";
import type { OrderVolumePoint } from "@/types/dashboard";

function formatDayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function RevenueOverviewTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as OrderVolumePoint & { label: string };
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-semibold text-fg">{point.label}</div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Revenue</span>
        <span className="font-medium tabular-nums text-fg">{formatCurrencyFromCents(point.revenueCents)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-fg/60">
        <span>Orders</span>
        <span className="font-medium tabular-nums text-fg">{point.orders}</span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useState<DateRangeValue>(() => getPresetRange(30));
  const rangeParams = { from: range.from, to: range.to };

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ["reports", "summary", range],
    queryFn: () => getReportsSummary(rangeParams),
  });

  const { data: volumeRes, isLoading: volumeLoading } = useQuery({
    queryKey: ["reports", "revenue-overview", range],
    queryFn: () => getOrderVolume(rangeParams),
  });

  const { data: channelRes, isLoading: channelLoading } = useQuery({
    queryKey: ["reports", "revenue-by-channel", range],
    queryFn: () => getRevenueByChannel(rangeParams),
  });

  const { data: categoriesRes, isLoading: categoriesLoading } = useQuery({
    queryKey: ["reports", "top-categories", range],
    queryFn: () => getTopCategories({ ...rangeParams, limit: 6 }),
  });

  const { data: performanceRes, isLoading: performanceLoading } = useQuery({
    queryKey: ["reports", "sales-performance", range],
    queryFn: () => getSalesPerformance(rangeParams),
  });

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });

  // Filtered on the same {from, to} as the cards above, not on a bare day
  // COUNT derived from the summary — that only ever meant "the last N days
  // ending today", so picking a past range silently showed this card a
  // different window, and any range outside the endpoint's old 7-90 day
  // bounds failed the request outright.
  const { data: turnoverRes, isLoading: turnoverLoading, isError: turnoverFailed } = useQuery({
    queryKey: ["reports", "inventory-turnover", range],
    queryFn: () => getInventoryTurnover(rangeParams),
  });

  const days = summaryRes?.data?.range.days ?? 30;

  const summary = summaryRes?.data;
  const channelRows = channelRes?.data ?? [];
  const categoryRows = categoriesRes?.data ?? [];
  const performanceRows = performanceRes?.data ?? [];
  const stats = statsRes?.data;
  const turnover = turnoverRes?.data;

  const rangeLabel = formatDateRangeLabel(range);

  const revenueChartData = useMemo(
    () => (volumeRes?.data?.points ?? []).map((p) => ({ ...p, label: formatDayLabel(p.date) })),
    [volumeRes],
  );

  // Real derived series (revenue ÷ orders per day) — no dedicated backend
  // field for it, unlike the other 4 cards' sparklines, since it's a simple
  // ratio of two already-fetched arrays.
  const dailyAvgOrderValueCents = useMemo(() => {
    if (!summary) return [];
    return summary.dailyRevenueCents.map((cents, i) => (summary.dailyOrders[i] > 0 ? Math.round(cents / summary.dailyOrders[i]) : 0));
  }, [summary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Reports &amp; Analytics
            <Badge>{days}-Day Audit</Badge>
          </span>
        }
        description="Track performance, inventory turnover velocity, and cross-channel profitability."
      >
        <DateRangePicker value={range} onChange={setRange} />
        <Button
          variant="primary"
          size="sm"
          className="gap-1.5"
          disabled={!summary}
          onClick={() =>
            summary &&
            downloadCsv("reports_summary", [
              {
                range: `${summary.range.from} – ${summary.range.to}`,
                revenue: (summary.revenueCents / 100).toFixed(2),
                orders: summary.orders,
                itemsSold: summary.itemsSold,
                avgOrderValue: (summary.avgOrderValueCents / 100).toFixed(2),
                grossProfit: (summary.grossProfitCents / 100).toFixed(2),
              },
            ])
          }
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ReportsMetricCard
          label="Total Revenue"
          value={summary ? formatCurrencyFromCents(summary.revenueCents) : "—"}
          changePct={summary?.revenueChangePct ?? null}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          colorVar="var(--color-accent)"
          sparkline={summary?.dailyRevenueCents ?? []}
          loading={summaryLoading}
        />
        <ReportsMetricCard
          label="Total Orders"
          value={summary?.orders ?? "—"}
          changePct={summary?.ordersChangePct ?? null}
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          colorVar="var(--color-cat-1)"
          sparkline={summary?.dailyOrders ?? []}
          loading={summaryLoading}
        />
        <ReportsMetricCard
          label="Items Sold"
          value={summary?.itemsSold ?? "—"}
          changePct={summary?.itemsSoldChangePct ?? null}
          icon={<Package className="h-3.5 w-3.5" />}
          colorVar="var(--color-cat-6)"
          sparkline={summary?.dailyItemsSold ?? []}
          loading={summaryLoading}
        />
        <ReportsMetricCard
          label="Avg. Order Value"
          value={summary ? formatCurrencyFromCents(summary.avgOrderValueCents) : "—"}
          changePct={summary?.avgOrderValueChangePct ?? null}
          icon={<BarChart2 className="h-3.5 w-3.5" />}
          colorVar="var(--color-cat-3)"
          sparkline={dailyAvgOrderValueCents}
          loading={summaryLoading}
        />
        <ReportsMetricCard
          label="Gross Profit"
          value={summary ? formatCurrencyFromCents(summary.grossProfitCents) : "—"}
          changePct={summary?.grossProfitChangePct ?? null}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          colorVar="var(--color-cat-4)"
          sparkline={summary?.dailyGrossProfitCents ?? []}
          loading={summaryLoading}
        />
      </div>

      <InventoryTurnoverCard turnover={turnover} loading={turnoverLoading} error={turnoverFailed} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="flex flex-col justify-between gap-4 p-5 shadow-card transition-shadow duration-300 hover:shadow-md lg:col-span-5">
          <div className="flex items-center justify-between">
            <DashboardSectionLabel badge={rangeLabel}>Revenue Overview</DashboardSectionLabel>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="text-fg/60">Revenue (AUD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-cat-1)" }} />
              <span className="text-fg/60">Orders</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {volumeLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueChartData}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-fg)", opacity: 0.5 }} />
                  <YAxis yAxisId="left" hide />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <Tooltip content={RevenueOverviewTooltip} cursor={{ fill: "var(--color-border)", opacity: 0.3 }} />
                  <Bar yAxisId="left" dataKey="revenueCents" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="var(--color-cat-1)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--color-cat-1)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="lg:col-span-3">
          <RevenueByChannelCard rows={channelRows} loading={channelLoading} />
        </div>

        <div className="lg:col-span-4">
          <TopCategoriesCard rows={categoryRows} loading={categoriesLoading} />
        </div>
      </div>

      {/* Two cards here, export panel on its own row below — NOT three
          across. Three needs ~1285px to render without something breaking
          (sales table ~470, insight tiles ~390 for a two-word label on one
          line, export rows ~380, plus gaps) and this row only has ~1170px on
          a 1512px screen. Every three-across split just moves the damage:
          5/3/4 wrapped every insight label onto two lines, 5/4/3 truncated
          every export title mid-word.

          Sized by CONTAINER width, not viewport width, because AppShell's
          sidebar is 260px expanded and 72px collapsed — the same viewport
          hands this row ~190px more or less space without any viewport
          breakpoint firing. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
          <div className="@3xl:col-span-7">
            <SalesPerformanceTable rows={performanceRows} loading={performanceLoading} />
          </div>

          <div className="@3xl:col-span-5">
            <InventoryInsightsCard stats={stats} turnoverRate={turnover?.summary.avgTurnoverRate} loading={statsLoading} />
          </div>

          <div className="@3xl:col-span-12">
            <ReportsExportPanel
              loading={performanceLoading || categoriesLoading || channelLoading}
              // Titles double as the CSV filename (see ReportsExportPanel)
              // and as the row label, which truncates in this card's share of
              // the row — so they drop the "Report" suffix the card heading
              // already implies.
              datasets={[
                {
                  id: "sales-summary",
                  title: "Sales Summary",
                  rows: performanceRows.map((r) => ({
                    channel: r.channel,
                    revenue: (r.revenueCents / 100).toFixed(2),
                    orders: r.orders,
                    itemsSold: r.itemsSold,
                  })),
                },
                {
                  id: "inventory-valuation",
                  title: "Inventory Valuation",
                  // Stock levels as they stand right now — this one comes from
                  // the dashboard stats endpoint, which takes no date range, so
                  // it can't claim to cover the selected one.
                  scopeLabel: "at current stock levels",
                  rows: stats ? [{ totalInventoryValue: stats.totalInventoryValue.toFixed(2), lowStockCount: stats.lowStockCount, outOfStockCount: stats.outOfStockCount }] : [],
                },
                {
                  id: "channel-performance",
                  title: "Channel Performance",
                  rows: channelRows.map((r) => ({ channel: r.channel, revenue: (r.revenueCents / 100).toFixed(2), percentOfTotal: r.pct.toFixed(1) })),
                },
                {
                  id: "category-breakdown",
                  title: "Category Breakdown",
                  rows: categoryRows.map((r) => ({ category: r.name, revenue: (r.revenueCents / 100).toFixed(2), percentOfTotal: r.pct.toFixed(1) })),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs sm:flex-row">
        <div className="flex items-center gap-2 font-medium text-fg">
          <Lightbulb className="h-4 w-4 shrink-0 text-accent" />
          <span>Sales reports cover your selected date range; inventory figures are current stock.</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Data reflects the latest orders and inventory on record</span>
        </div>
      </div>
    </div>
  );
}
