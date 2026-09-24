import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, DollarSign, Download, Lightbulb, Package, RefreshCw, ShoppingCart, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshControl } from "@/components/shared/RefreshControl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { ReportsMetricCard } from "@/components/reports/ReportsMetricCard";
import { RevenueOverviewChart } from "@/components/reports/RevenueOverviewChart";
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
import { PAGE_REFETCH_MS } from "@/config/refresh";
import { downloadPdf } from "@/utils/pdf";
import { formatCurrencyFromCents } from "@/utils/format";
import { formatDateRangeLabel, getPresetRange } from "@/utils/dateRange";
import type { DateRangeValue } from "@/utils/dateRange";

const DEFAULT_RANGE_DAYS = 7;
export default function ReportsPage() {
  // Defaults to last 7 days: most-checked range, and daily buckets label cleanly.
  const [range, setRange] = useState<DateRangeValue>(() => getPresetRange(DEFAULT_RANGE_DAYS));
  const rangeParams = { from: range.from, to: range.to };

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ["reports", "summary", range],
    queryFn: () => getReportsSummary(rangeParams),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: volumeRes, isLoading: volumeLoading } = useQuery({
    queryKey: ["reports", "revenue-overview", range],
    queryFn: () => getOrderVolume(rangeParams),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: channelRes, isLoading: channelLoading } = useQuery({
    queryKey: ["reports", "revenue-by-channel", range],
    queryFn: () => getRevenueByChannel(rangeParams),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: categoriesRes, isLoading: categoriesLoading } = useQuery({
    queryKey: ["reports", "top-categories", range],
    queryFn: () => getTopCategories({ ...rangeParams, limit: 6 }),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: performanceRes, isLoading: performanceLoading } = useQuery({
    queryKey: ["reports", "sales-performance", range],
    queryFn: () => getSalesPerformance(rangeParams),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    refetchInterval: PAGE_REFETCH_MS,
  });

  // Same {from, to} as the cards above, so past ranges show the same window.
  const { data: turnoverRes, isLoading: turnoverLoading, isError: turnoverFailed } = useQuery({
    queryKey: ["reports", "inventory-turnover", range],
    queryFn: () => getInventoryTurnover(rangeParams),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const days = summaryRes?.data?.range.days ?? DEFAULT_RANGE_DAYS;

  const summary = summaryRes?.data;
  const channelRows = channelRes?.data ?? [];
  const categoryRows = categoriesRes?.data ?? [];
  const performanceRows = performanceRes?.data ?? [];
  const stats = statsRes?.data;
  const turnover = turnoverRes?.data;

  const rangeLabel = formatDateRangeLabel(range);

  const revenueChartData = useMemo(() => volumeRes?.data?.points ?? [], [volumeRes]);

  // Derived revenue/orders ratio; no backend field needed for this sparkline.
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
            downloadPdf("reports_summary", [
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
          Export PDF
        </Button>
        {/* /reports queries plus dashboard stats (insights, valuation export). */}
        <RefreshControl queryKeys={[["reports"], ["dashboard", "stats"]]} />
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

      {/* Container query: sidebar width skews viewport breakpoints by ~190px. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
          <Card className="flex flex-col justify-between gap-4 p-5 shadow-card transition-shadow duration-300 hover:shadow-md @3xl:col-span-7 @6xl:col-span-5">
            <div className="flex items-center justify-between">
              <DashboardSectionLabel badge={rangeLabel}>Revenue Overview</DashboardSectionLabel>
            </div>

            <RevenueOverviewChart points={revenueChartData} loading={volumeLoading} />
          </Card>

          <div className="@3xl:col-span-5 @6xl:col-span-3">
            <RevenueByChannelCard rows={channelRows} loading={channelLoading} />
          </div>

          <div className="@3xl:col-span-12 @6xl:col-span-4">
            <TopCategoriesCard rows={categoryRows} loading={categoriesLoading} />
          </div>
        </div>
      </div>

      {/* Two cards + export row below: three across doesn't fit; container-sized. */}
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
              // Titles are the PDF filename and a truncating row label: no "Report" suffix.
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
                  // Dashboard stats take no date range, so this reflects current stock only.
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
        <div className="flex items-center gap-2 text-2xs font-semibold text-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Data reflects the latest orders and inventory on record</span>
        </div>
      </div>
    </div>
  );
}
