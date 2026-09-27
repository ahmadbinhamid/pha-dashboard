import { useQuery } from "@tanstack/react-query";
import { Boxes, Package, PackageX, TriangleAlert } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { INVENTORY_STATS_QUERY_KEY, getInventoryStats } from "@/lib/api/inventory";
import { pluralize } from "@/utils/format";

// Headline stock counts; refreshes with any ["inventory"] invalidation.
export function InventoryStatCards() {
  const { data, isLoading } = useQuery({ queryKey: INVENTORY_STATS_QUERY_KEY, queryFn: getInventoryStats });
  const stats = data?.data;
  const hasLow = !!stats && stats.lowStockCount > 0;
  const hasOut = !!stats && stats.outOfStockCount > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        size="sm"
        label="Tracked Items"
        value={stats ? stats.trackedItems : "—"}
        subLabel="Products and variants"
        icon={<Boxes className="h-4 w-4" />}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Units in Stock"
        value={stats ? stats.unitsInStock : "—"}
        subLabel="Across all locations"
        icon={<Package className="h-4 w-4" />}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Low Stock"
        value={stats ? stats.lowStockCount : "—"}
        subLabel={stats ? `${pluralize(stats.lowStockThreshold, "unit")} or fewer left` : undefined}
        icon={<TriangleAlert className="h-4 w-4" />}
        tone={hasLow ? "warn" : "ok"}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Out of Stock"
        value={stats ? stats.outOfStockCount : "—"}
        subLabel={stats ? (hasOut ? "Reorders needed" : "All in stock") : undefined}
        icon={<PackageX className="h-4 w-4" />}
        tone={hasOut ? "danger" : "ok"}
        loading={isLoading}
      />
    </div>
  );
}
