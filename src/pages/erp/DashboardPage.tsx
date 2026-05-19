import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SalesChartCard } from "@/components/dashboard/sales-chart-card";
import { RecentOrdersCard } from "@/components/dashboard/recent-orders-card";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { DashboardCounterSearch } from "@/components/counter/dashboard-counter-search";

export default function DashboardPage() {
  return (
    <div className="space-y-section">
      <DashboardCounterSearch />

      <KpiCards />

      <div className="grid grid-cols-1 gap-section lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChartCard />
        </div>
        <ActivityFeedCard />
      </div>

      <RecentOrdersCard />
    </div>
  );
}
