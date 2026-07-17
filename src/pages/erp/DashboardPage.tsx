import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { ListingSyncBreakdownCard } from "@/components/dashboard/ListingSyncBreakdownCard";
import { RecentPaymentsCard } from "@/components/dashboard/RecentPaymentsCard";
import { getProducts } from "@/lib/api/products";
import { getListings } from "@/lib/api/listings";
import { getPayments } from "@/lib/api/payments";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Payment } from "@/types/payment";
import type { RevenueTrendPoint, SyncStatusBreakdownItem } from "@/types/dashboard";
import { Package, Cloud, DollarSign, Clock } from "lucide-react";

const TREND_DAYS = 14;

function buildRevenueTrend(payments: Payment[]): RevenueTrendPoint[] {
  const byDate = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "succeeded" || !p.paid_at) continue;
    const date = p.paid_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + p.amount);
  }

  const points: RevenueTrendPoint[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    points.push({ date, totalCents: byDate.get(date) ?? 0 });
  }
  return points;
}

export default function DashboardPage() {
  const { data: productsTotal, isLoading: productsLoading } = useQuery({
    queryKey: ["dashboard", "products-total"],
    queryFn: () => getProducts({ page: 1 }),
  });

  const { data: activeProducts } = useQuery({
    queryKey: ["dashboard", "products-active"],
    queryFn: () => getProducts({ page: 1, status: "active" }),
  });

  const { data: listingsTotal, isLoading: listingsLoading } = useQuery({
    queryKey: ["dashboard", "listings-total"],
    queryFn: () => getListings({ page: 1, limit: 1 }),
  });

  const syncedQuery = useQuery({
    queryKey: ["dashboard", "listings-sync", "synced"],
    queryFn: () => getListings({ page: 1, limit: 1, sync_status: "synced" }),
  });
  const pendingSyncQuery = useQuery({
    queryKey: ["dashboard", "listings-sync", "pending"],
    queryFn: () => getListings({ page: 1, limit: 1, sync_status: "pending" }),
  });
  const errorSyncQuery = useQuery({
    queryKey: ["dashboard", "listings-sync", "error"],
    queryFn: () => getListings({ page: 1, limit: 1, sync_status: "error" }),
  });
  const notListedQuery = useQuery({
    queryKey: ["dashboard", "listings-sync", "not_listed"],
    queryFn: () => getListings({ page: 1, limit: 1, sync_status: "not_listed" }),
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ["dashboard", "payments-pending"],
    queryFn: () => getPayments({ page: 1, limit: 1, status: "pending" }),
  });

  const { data: recentPaymentsRes, isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard", "payments-recent"],
    queryFn: () => getPayments({ page: 1, limit: 8 }),
  });

  const { data: succeededPaymentsRes, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard", "payments-succeeded-trend"],
    queryFn: () => getPayments({ page: 1, limit: 200, status: "succeeded" }),
  });

  const succeededPayments = (succeededPaymentsRes?.data?.items ?? []) as Payment[];
  const recentPayments = (recentPaymentsRes?.data?.items ?? []) as Payment[];
  const revenueTotalCents = succeededPayments.reduce((sum, p) => sum + p.amount, 0);
  const trendPoints = buildRevenueTrend(succeededPayments);

  const syncBreakdown: SyncStatusBreakdownItem[] = [
    { status: "synced", count: syncedQuery.data?.data?.total ?? 0 },
    { status: "pending", count: pendingSyncQuery.data?.data?.total ?? 0 },
    { status: "error", count: errorSyncQuery.data?.data?.total ?? 0 },
    { status: "not_listed", count: notListedQuery.data?.data?.total ?? 0 },
  ];
  const syncBreakdownLoading =
    syncedQuery.isLoading || pendingSyncQuery.isLoading || errorSyncQuery.isLoading || notListedQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="An overview of your store's performance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Products"
          value={productsTotal?.data?.total ?? 0}
          subLabel={
            activeProducts?.data?.total != null
              ? `${activeProducts.data.total} active`
              : undefined
          }
          icon={<Package className="h-4 w-4" />}
          loading={productsLoading}
        />
        <MetricCard
          label="Live Listings"
          value={syncBreakdown.find((s) => s.status === "synced")?.count ?? 0}
          subLabel={
            listingsTotal?.data?.total != null
              ? `${listingsTotal.data.total} total listings`
              : undefined
          }
          icon={<Cloud className="h-4 w-4" />}
          loading={listingsLoading}
        />
        <MetricCard
          label="Revenue"
          value={formatCurrencyFromCents(revenueTotalCents)}
          subLabel={`from ${succeededPayments.length} succeeded payment${succeededPayments.length !== 1 ? "s" : ""}`}
          icon={<DollarSign className="h-4 w-4" />}
          loading={revenueLoading}
        />
        <MetricCard
          label="Pending Payments"
          value={pendingPayments?.data?.total ?? 0}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendCard points={trendPoints} loading={revenueLoading} />
        </div>
        <ListingSyncBreakdownCard items={syncBreakdown} loading={syncBreakdownLoading} />
      </div>

      <RecentPaymentsCard payments={recentPayments} loading={recentLoading} />
    </div>
  );
}
