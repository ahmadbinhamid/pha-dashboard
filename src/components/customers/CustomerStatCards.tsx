import { useQuery } from "@tanstack/react-query";
import { CreditCard, UserCheck, UserPlus, Users } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CUSTOMER_STATS_QUERY_KEY, getCustomerStats } from "@/lib/api/customers";

// Headline customer counts; refreshes with any ["customers"] invalidation.
export function CustomerStatCards() {
  const { data, isLoading } = useQuery({ queryKey: CUSTOMER_STATS_QUERY_KEY, queryFn: getCustomerStats });
  const stats = data?.data;
  const hasUnpaid = !!stats && stats.withUnpaidInvoices > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        size="sm"
        label="Total Customers"
        value={stats ? stats.totalCustomers : "—"}
        icon={<Users className="h-4 w-4" />}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Online Accounts"
        value={stats ? stats.onlineAccounts : "—"}
        subLabel="Can sign in to the storefront"
        icon={<UserCheck className="h-4 w-4" />}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Unpaid Invoices"
        value={stats ? stats.withUnpaidInvoices : "—"}
        subLabel={stats ? (hasUnpaid ? "Customers with money owing" : "All settled") : undefined}
        icon={<CreditCard className="h-4 w-4" />}
        tone={hasUnpaid ? "warn" : "ok"}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="New This Month"
        value={stats ? stats.newThisMonth : "—"}
        icon={<UserPlus className="h-4 w-4" />}
        loading={isLoading}
      />
    </div>
  );
}
