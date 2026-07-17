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
import type { EbayListing, ListingSyncStatus } from "@/types/marketplace";
import type { Product } from "@/types/product";
import type { RevenueTrendPoint, SyncStatusBreakdownItem } from "@/types/dashboard";
import { Package, Cloud, DollarSign, Clock } from "lucide-react";

const TREND_DAYS = 14;

// Fetched once per resource, capped generously — fine for this store's actual
// scale today. Revisit with a real backend aggregate endpoint if any of these
// counts grow past ~100.
const DASHBOARD_FETCH_LIMIT = 100;

const SYNC_STATUSES: ListingSyncStatus[] = ["synced", "pending", "error", "not_listed"];

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
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: () => getProducts({ page: 1, limit: DASHBOARD_FETCH_LIMIT }),
  });

  const { data: listingsRes, isLoading: listingsLoading } = useQuery({
    queryKey: ["dashboard", "listings"],
    queryFn: () => getListings({ page: 1, limit: DASHBOARD_FETCH_LIMIT }),
  });

  const { data: paymentsRes, isLoading: paymentsLoading } = useQuery({
    queryKey: ["dashboard", "payments"],
    queryFn: () => getPayments({ page: 1, limit: DASHBOARD_FETCH_LIMIT }),
  });

  const products = (productsRes?.data?.items ?? []) as Product[];
  const listings = (listingsRes?.data?.items ?? []) as EbayListing[];
  const payments = (paymentsRes?.data?.items ?? []) as Payment[];

  const productsTotal = productsRes?.data?.total ?? 0;
  const activeProductsCount = products.filter((p) => p.status === "active").length;

  const listingsTotal = listingsRes?.data?.total ?? 0;
  const syncBreakdown: SyncStatusBreakdownItem[] = SYNC_STATUSES.map((status) => ({
    status,
    count: listings.filter((l) => l.sync_status === status).length,
  }));
  const liveListingsCount = syncBreakdown.find((s) => s.status === "synced")?.count ?? 0;

  const succeededPayments = payments.filter((p) => p.status === "succeeded");
  const pendingPaymentsCount = payments.filter((p) => p.status === "pending").length;
  const revenueTotalCents = succeededPayments.reduce((sum, p) => sum + p.amount, 0);
  const trendPoints = buildRevenueTrend(payments);
  const recentPayments = payments.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="An overview of your store's performance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Products"
          value={productsTotal}
          subLabel={`${activeProductsCount} active`}
          icon={<Package className="h-4 w-4" />}
          loading={productsLoading}
        />
        <MetricCard
          label="Live Listings"
          value={liveListingsCount}
          subLabel={`${listingsTotal} total listings`}
          icon={<Cloud className="h-4 w-4" />}
          loading={listingsLoading}
        />
        <MetricCard
          label="Revenue"
          value={formatCurrencyFromCents(revenueTotalCents)}
          subLabel={`from ${succeededPayments.length} succeeded payment${succeededPayments.length !== 1 ? "s" : ""}`}
          icon={<DollarSign className="h-4 w-4" />}
          loading={paymentsLoading}
        />
        <MetricCard
          label="Pending Payments"
          value={pendingPaymentsCount}
          icon={<Clock className="h-4 w-4" />}
          loading={paymentsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendCard points={trendPoints} loading={paymentsLoading} />
        </div>
        <ListingSyncBreakdownCard items={syncBreakdown} loading={listingsLoading} />
      </div>

      <RecentPaymentsCard payments={recentPayments} loading={paymentsLoading} />
    </div>
  );
}
