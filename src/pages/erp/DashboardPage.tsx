import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OrderVolumeChart } from "@/components/dashboard/OrderVolumeChart";
import { ActiveChannelsCard } from "@/components/dashboard/ActiveChannelsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { CriticalStockCard } from "@/components/dashboard/CriticalStockCard";
import { getDashboardStats, getActiveChannels, getOrderVolume, getRecentActivity, getCriticalStock } from "@/lib/api/dashboard";
import { formatCurrency } from "@/utils/format";
import { Boxes, AlertTriangle, Clock, Radio } from "lucide-react";

const ORDER_VOLUME_DAYS = 7;
// Recent Activity polls rather than push — good enough at this scale, and
// honest about not actually being a websocket-driven live feed.
const ACTIVITY_REFETCH_MS = 30_000;

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });

  const { data: channelsRes, isLoading: channelsLoading } = useQuery({
    queryKey: ["dashboard", "channels"],
    queryFn: getActiveChannels,
  });

  const { data: volumeRes, isLoading: volumeLoading } = useQuery({
    queryKey: ["dashboard", "order-volume", ORDER_VOLUME_DAYS],
    queryFn: () => getOrderVolume(ORDER_VOLUME_DAYS),
  });

  const { data: activityRes, isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => getRecentActivity(10),
    refetchInterval: ACTIVITY_REFETCH_MS,
  });

  const { data: criticalStockRes, isLoading: criticalStockLoading } = useQuery({
    queryKey: ["dashboard", "critical-stock"],
    queryFn: () => getCriticalStock(10),
  });

  const stats = statsRes?.data;
  const channels = channelsRes?.data ?? [];
  const volumePoints = volumeRes?.data ?? [];
  const activityEvents = activityRes?.data ?? [];
  const criticalStock = criticalStockRes?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="An overview of your store's performance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Inventory Value"
          value={stats ? formatCurrency(stats.totalInventoryValue) : "—"}
          subLabel="Across all locations"
          icon={<Boxes className="h-4 w-4" />}
          loading={statsLoading}
          onClick={() => navigate("/inventory")}
        />
        <MetricCard
          label="Low Stock Items"
          value={stats?.lowStockCount ?? 0}
          subLabel={
            stats && stats.outOfStockCount > 0 ? (
              <span className="text-danger">{stats.outOfStockCount} out of stock</span>
            ) : (
              "None out of stock"
            )
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={statsLoading}
          onClick={() =>
            navigate(`/products?stock=${stats && stats.outOfStockCount > 0 ? "out_of_stock" : "low_stock"}`)
          }
        />
        <MetricCard
          label="Pending Orders"
          value={stats?.pendingOrdersCount ?? 0}
          subLabel={
            stats && stats.pendingOrdersCount > 0
              ? `Avg age: ${stats.pendingOrdersAvgAgeHours.toFixed(1)}h`
              : "All settled"
          }
          icon={<Clock className="h-4 w-4" />}
          loading={statsLoading}
          onClick={() => navigate("/orders?fulfillment_status=pending")}
        />
        <MetricCard
          label="Sync Stability"
          value={stats ? `${stats.syncStabilityPct}%` : "—"}
          subLabel={stats ? `${stats.channelsOperational}/${stats.channelsTotal} channels operational` : undefined}
          icon={<Radio className="h-4 w-4" />}
          loading={statsLoading}
          onClick={() => navigate("/listings")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderVolumeChart points={volumePoints} loading={volumeLoading} />
        </div>
        <ActiveChannelsCard channels={channels} loading={channelsLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivityCard events={activityEvents} loading={activityLoading} />
        <CriticalStockCard items={criticalStock} loading={criticalStockLoading} />
      </div>
    </div>
  );
}
