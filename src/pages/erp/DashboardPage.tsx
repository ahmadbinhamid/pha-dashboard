import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefreshControl } from "@/components/shared/RefreshControl";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { OrderVolumeChart } from "@/components/dashboard/OrderVolumeChart";
import { ActiveChannelsCard } from "@/components/dashboard/ActiveChannelsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { CriticalStockCard } from "@/components/dashboard/CriticalStockCard";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import {
  getDashboardStats,
  getActiveChannels,
  getOrderVolume,
  getRecentActivity,
  getCriticalStock,
} from "@/lib/api/dashboard";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { formatCurrency } from "@/utils/format";
import { PAGE_REFETCH_MS } from "@/config/refresh";
import { formatDateRangeLabel, getPresetRange } from "@/utils/dateRange";
import type { DateRangeValue } from "@/utils/dateRange";
import { Boxes, AlertTriangle, Clock, Radio } from "lucide-react";

// Recent Activity polls rather than push, faster than page-wide PAGE_REFETCH_MS since a several-minute lag here reads as "nothing is happening".
const ACTIVITY_REFETCH_MS = 30_000;

export default function DashboardPage() {
  const navigate = useNavigate();
  const [orderVolumeRange, setOrderVolumeRange] = useState<DateRangeValue>(() => getPresetRange(7));

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: channelsRes, isLoading: channelsLoading } = useQuery({
    queryKey: ["dashboard", "channels"],
    queryFn: getActiveChannels,
    refetchInterval: PAGE_REFETCH_MS,
  });

  // Shared ["tenant-settings"] query key (also used by AppearanceTab.tsx/ProductEditPage.tsx), here for the "storefront" row's logo in ActiveChannelsCard.
  const { data: tenantSettingsRes } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });

  // Single query for the date-range-filtered section: Order Volume and Revenue Trends both render off this same series, so they always agree on the period shown.
  const { data: volumeRes, isLoading: volumeLoading } = useQuery({
    queryKey: ["dashboard", "order-volume", orderVolumeRange],
    queryFn: () => getOrderVolume(orderVolumeRange),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const { data: activityRes, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => getRecentActivity(10),
    refetchInterval: ACTIVITY_REFETCH_MS,
  });

  const { data: criticalStockRes, isLoading: criticalStockLoading } = useQuery({
    queryKey: ["dashboard", "critical-stock"],
    queryFn: () => getCriticalStock(10),
    refetchInterval: PAGE_REFETCH_MS,
  });

  const stats = statsRes?.data;
  const channels = channelsRes?.data ?? [];
  const volumePoints = volumeRes?.data?.points ?? [];
  const previousPeriodRevenueCents = volumeRes?.data?.previousPeriodRevenueCents;
  const rangeLabel = formatDateRangeLabel(orderVolumeRange);
  const activityEvents = activityRes?.data ?? [];
  const criticalStock = criticalStockRes?.data ?? [];

  const syncHealthy = stats ? stats.syncStabilityPct >= 90 : true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Store performance overview, sales volume & real time inventory telemetry"
      >
        <DateRangePicker value={orderVolumeRange} onChange={setOrderVolumeRange} />
        <RefreshControl queryKeys={[["dashboard"]]} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Inventory Value"
          value={stats ? formatCurrency(stats.totalInventoryValue) : "—"}
          badge={
            stats && stats.inventoryValueChangePct !== null
              ? `${stats.inventoryValueChangePct >= 0 ? "+" : ""}${stats.inventoryValueChangePct.toFixed(1)}%`
              : undefined
          }
          subLabel="Across all locations"
          icon={<Boxes className="h-4 w-4" />}
          tone={stats && stats.inventoryValueChangePct !== null && stats.inventoryValueChangePct < 0 ? "danger" : "accent"}
          loading={statsLoading}
          onClick={() => navigate("/inventory")}
        />
        <MetricCard
          label="Low Stock Items"
          value={stats?.lowStockCount ?? 0}
          badge={stats && stats.outOfStockCount > 0 ? `${stats.outOfStockCount} critical` : "Stable"}
          subLabel={
            stats && stats.outOfStockCount > 0 ? "Restock required urgently" : "All stock levels healthy"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats && stats.outOfStockCount > 0 ? "danger" : "ok"}
          loading={statsLoading}
          onClick={() =>
            navigate(`/products?stock=${stats && stats.outOfStockCount > 0 ? "out_of_stock" : "low_stock"}`)
          }
        />
        <MetricCard
          label="Pending Orders"
          value={stats?.pendingOrdersCount ?? 0}
          badge={
            stats && stats.pendingOrdersCount > 0
              ? `Avg ${stats.pendingOrdersAvgAgeHours.toFixed(1)}h`
              : "Settled"
          }
          subLabel={stats && stats.pendingOrdersCount > 0 ? "Ready for warehouse pack" : "All orders settled"}
          icon={<Clock className="h-4 w-4" />}
          tone={stats && stats.pendingOrdersCount > 0 ? "warn" : "ok"}
          loading={statsLoading}
          onClick={() => navigate("/orders?fulfillment_status=pending")}
        />
        <MetricCard
          label="Sync Stability"
          value={stats ? `${stats.syncStabilityPct}%` : "—"}
          badge={stats ? (syncHealthy ? "Healthy" : "Attention") : undefined}
          subLabel={stats ? `${stats.channelsOperational}/${stats.channelsTotal} channels operational` : undefined}
          icon={<Radio className="h-4 w-4" />}
          tone={syncHealthy ? "ok" : "danger"}
          loading={statsLoading}
          onClick={() => navigate("/listings")}
        />
      </div>

      <RevenueTrendChart
        points={volumePoints}
        previousPeriodRevenueCents={previousPeriodRevenueCents}
        rangeLabel={rangeLabel}
        loading={volumeLoading}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderVolumeChart points={volumePoints} loading={volumeLoading} />
        </div>
        <ActiveChannelsCard channels={channels} loading={channelsLoading} tenantLogoUrl={tenantSettingsRes?.data?.logo_url} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RecentActivityCard events={activityEvents} loading={activityLoading} />
        <CriticalStockCard items={criticalStock} loading={criticalStockLoading} />
      </div>
    </div>
  );
}
