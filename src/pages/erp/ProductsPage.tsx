import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { ChannelFilterBar } from "@/components/channels/ChannelFilterBar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ViewMode } from "@/components/ui/ViewToggle";
import { ProductsTab } from "@/components/products/ProductsTab";
import { NoChannelsConnectedCard } from "@/components/channels/NoChannelsConnectedCard";
import { getChannels } from "@/lib/api/channels";
import { getProductStats } from "@/lib/api/products";
import { formatCurrency } from "@/utils/format";
import { Blocks, Layers, Plus, Tag, TriangleAlert } from "lucide-react";

// Fetches GET /channels via the shared ["channels"] query key (also used by ListingsPage/GoogleConnectCard/ProductEditPage) so stat cards and the filter bar share one source of truth.
export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  const channels = data?.data ?? [];

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["products", "stats"],
    queryFn: getProductStats,
  });
  const stats = statsRes?.data;

  const connectedChannelCount = channels.filter((c) => c.connection.status === "connected").length;
  const totalListings = channels.reduce(
    (sum, c) => sum + Object.values(c.listing_counts).reduce((a, b) => a + b, 0),
    0,
  );
  const hasOutOfStock = !!stats && stats.outOfStockCount > 0;

  // Same p_channel/view query params ProductsTab reads — this bar and that tab share the URL, no prop plumbing needed.
  const channelFilter = searchParams.get("p_channel") ?? "";
  const view: ViewMode = searchParams.get("view") === "grid" ? "grid" : "list";

  function setChannelFilter(val: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set("p_channel", val);
      else next.delete("p_channel");
      next.set("p_page", "1");
      return next;
    });
  }

  function setView(mode: ViewMode) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode === "grid") next.set("view", "grid");
      else next.delete("view");
      next.delete("p_limit");
      next.set("p_page", "1");
      return next;
    });
  }

  function goToStockFilter(stock: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("stock", stock);
      next.set("p_page", "1");
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Auto parts inventory, multi-channel feeds, and specifications."
      >
        <Button variant="primary" size="md" className="gap-2" onClick={() => navigate("/products/new")}>
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          size="sm"
          label="Total SKUs"
          value={stats ? stats.totalSkus : "—"}
          subLabel={stats ? `${stats.totalStockUnits} unit${stats.totalStockUnits !== 1 ? "s" : ""} in stock` : undefined}
          icon={<Layers className="h-4 w-4" />}
          loading={statsLoading}
        />
        <MetricCard
          size="sm"
          label="Channel Listings"
          value={totalListings}
          subLabel={`Across ${connectedChannelCount || channels.length} channel${(connectedChannelCount || channels.length) !== 1 ? "s" : ""}`}
          icon={<Blocks className="h-4 w-4" />}
          loading={isLoading}
          onClick={() => navigate("/listings")}
        />
        <MetricCard
          size="sm"
          label="Out of Stock"
          value={stats ? stats.outOfStockCount : "—"}
          subLabel={stats ? (hasOutOfStock ? "Reorders needed" : "All stock levels healthy") : undefined}
          icon={<TriangleAlert className="h-4 w-4" />}
          tone={hasOutOfStock ? "danger" : "ok"}
          loading={statsLoading}
          onClick={hasOutOfStock ? () => goToStockFilter("out_of_stock") : undefined}
        />
        <MetricCard
          size="sm"
          label="Average Price"
          value={stats ? formatCurrency(stats.avgPrice) : "—"}
          subLabel={stats && stats.avgMarginPct !== null ? `~${Math.round(stats.avgMarginPct)}% avg margin` : "Add cost prices to see margin"}
          icon={<Tag className="h-4 w-4" />}
          loading={statsLoading}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-11 w-full rounded-2xl" />
      ) : channels.length === 0 ? (
        <NoChannelsConnectedCard />
      ) : (
        <ChannelFilterBar
          channels={channels}
          totalProducts={stats?.totalSkus ?? 0}
          value={channelFilter}
          onChange={setChannelFilter}
          view={view}
          onViewChange={setView}
        />
      )}

      <ProductsTab channels={channels} />
    </div>
  );
}
